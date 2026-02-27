import nodemailer from 'nodemailer';
import { config as serpConfig, getJson as serpWebSearch } from 'serpapi';

import { spawn } from 'child_process';
import { runWithQueue } from './terminalQueue.js';

import fs from 'fs';
import { Client } from 'ssh2';
import { getNextPort } from '../utils/portManager.js';
import { Planner } from '../planner/planner.js';


// import { whatsapp } from 'node-whatsapp';

// whatsapp.login('yourphonenumber@whatsapp.net', 'yourpassword');

class Tool {
    constructor(name, description) {
        this.name = name;
        this.description = description;
    }
    async call(input, context = {}) {
        throw new Error('call() not implemented for ' + this.name);
    }
}

class ToolRegistry {
    constructor() {
        this.tools = new Map();
    }
    register(tool) {
        this.tools.set(tool.name, tool);
    }
    get(name) {
        return this.tools.get(name);
    }
}

class EmailSenderTool extends Tool {
    constructor() {
        super('send_email', 'Send an email to a specified address with subject and body');
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
    }
    async call(input) {
        try {
            const { to, subject, body } = input;
            const result = await this.transporter.sendMail({
                from: process.env.EMAIL_USER,
                to,
                subject,
                html: body,
            });
            return { ok: true, result };
        } catch (err) {
            console.error('Error in EmailSenderTool:', err);
            return { ok: false, error: err.message };
        }
    }
}

class WebSearchTool extends Tool {
    constructor() {
        super('web_search', 'Search the web for a query and return the top 3 results');

        serpConfig.api_key = process.env.SERP_API_KEY;
        serpConfig.timeout = 60000;
    }

    async call(input) {
        try {
            const { query } = input;

            const response = await serpWebSearch({
                engine: "google",
                q: query
            });

            const results = response.organic_results || [];

            const formatted = results.slice(0, 3).map(r => ({
                title: r.title,
                link: r.link,
                snippet: r.snippet
            }));

            return {
                ok: true,
                result: formatted.length ? formatted : "No results found"
            };

        } catch (err) {
            console.log('Error in WebSearchTool:', err.message);

            return {
                ok: false,
                error: err.message
            };
        }
    }
}

class WhatsAppSenderTool extends Tool {
    constructor() {
        super('send_whatsapp', 'Send a WhatsApp message to a specified phone number with message content');
    }
    async call(input) {
        try {
            const { to, message } = input;
            const whatsapp = {
                to,
                message
            };
            // throw new Error('WhatsApp API integration not implemented yet');
            return { ok: true, result: whatsapp };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    }
}

// 5) Terminal Tool: execute terminal commands (use with caution)

const forbidden = ['rm', 'sudo', 'shutdown', 'reboot'];
function validateCmd(cmd) {
    return !forbidden.some(f => cmd.includes(f));
}

class TerminalTool extends Tool {
    constructor() {
        super('terminal', 'Provide and execute terminal commands (linux/mac/windows).');
    }

    async call(input) {
        try {
            const { cmd } = input;
            if (!cmd) return { ok: false, error: 'cmd required' };
            if (!validateCmd(cmd)) {
                return { ok: false, error: 'Forbidden command' };
            }

            const result = await runWithQueue(() => runInDocker(cmd));
            if (result.stderr) {
                return { ok: false, result }
            }
            return { ok: true, result };
        } catch (err) {
            console.error('Terminal command error:', err);
            return { ok: false, error: 'exec_error: ' + err.message };
        }
    }
}

function runInDocker(cmd, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const dockerCmd = [
            'run', // run a container
            '--rm', // remove container after execution
            '--network', 'none', // no internet (important)
            '--memory', '128m', // limit memory (128MB)
            '--cpus', '0.5', // limit CPU (0.5 cores)
            'ubuntu', //base image
            'bash', // command to run
            '-c', // execute command
            cmd,
        ];

        const child = spawn('docker', dockerCmd);

        let stdout = '';
        let stderr = '';

        const timer = setTimeout(() => {
            child.kill('SIGKILL'); // forcefully terminates a child process immediately without allowing cleanup.
            reject(new Error('Execution timeout'));
        }, timeout);

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        })

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        })

        child.on('close', (code) => {
            clearTimeout(timer);
            resolve({
                stdout,
                stderr,
                code
            })
        })

        child.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        })
    })
}

class DeployTool extends Tool {
    constructor() {
        super('deploy_repo', 'Deploy a GitHub repository to preconfigured EC2 instance');
    }

    async call(input, context = {}) {
        const { repoUrl, port = getNextPort() } = input;
        const { env } = context;
        console.log(input);

        if (!repoUrl) {
            return { ok: false, error: 'repoUrl required' };
        }

        if (!repoUrl.startsWith('https://github.com/')) {
            return { ok: false, error: 'Only GitHub repos allowed' };
        }

        const appName = `app-${Date.now()}`;

        console.log(`Deploying ${repoUrl} as ${appName} on port ${port}`);

        try {
            // Step 1: Clone repo and inspect structure
            const inspectCommands = [
                'mkdir -p ~/apps',
                'cd ~/apps',
                `git clone ${repoUrl} ${appName}`,
                `cd ${appName}`,
                'echo "FILES_START"',
                'ls',
                'echo "FILES_END"',
                'echo "PACKAGE_START"',
                '[ -f package.json ] && cat package.json || echo "NO_PACKAGE_JSON"',
                'echo "PACKAGE_END"'
            ];

            const inspectResult = await runSSHCommands(inspectCommands);

            console.log('Inspect result:');
            console.log(inspectResult);

            // Step 2: Ask AI how to start
            const prompt = `
You are a deployment assistant.

Repository structure:
${inspectResult.output}

Determine how to start this Node.js project.

Rules:
- If package.json has "start" script → use "npm start"
- If package.json has main → use "node <main>"
- If index.js exists → use "node index.js"
- If nothing found → return null

Return JSON only:
{ "startCommand": "npm start" }
`;

            const llmResult = await Planner.callLLM(prompt);

            console.log('LLM result:');
            console.log(llmResult);

            if (!llmResult || !llmResult.startCommand) {
                return { ok: false, error: 'Could not determine start command' };
            }

            const startCommand = llmResult.startCommand;

            // Step 3: Create Dockerfile dynamically
            const dockerCommands = [
                `cd ~/apps/${appName}`
            ];

            // Create .env file if env provided
            if (env && Object.keys(env).length > 0) {
                const envLines = Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\\n');
                dockerCommands.push(`echo -e '${envLines}' > .env`);
            }

            dockerCommands.push(
                `echo 'FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ${JSON.stringify(startCommand.split(' '))}
' > Dockerfile`,
                `docker build -t ${appName} .`
            );

            // Add env-file flag if env provided
            const dockerRunCmd = env && Object.keys(env).length > 0 
                ? `docker run -d --name ${appName} -p ${port}:4000 --env-file .env ${appName}`
                : `docker run -d --name ${appName} -p ${port}:4000 ${appName}`;
            
            dockerCommands.push(dockerRunCmd);

            const deployResult = await runSSHCommands(dockerCommands);

            console.log('Deploy result:');
            console.log(deployResult);

            return {
                ok: true,
                result: {
                    appName,
                    startCommand,
                    url: `http://${process.env.EC2_HOST}:${port}`,
                    logs: deployResult.output
                }
            };

        } catch (err) {
            console.error('Deployment error:', err);
            return { ok: false, error: err.message };
        }
    }
}


function runSSHCommands(commands) {
    return new Promise((resolve, reject) => {
        const conn = new Client();

        conn.on('ready', () => {
            conn.exec(commands.join(' && '), (err, stream) => {
                if (err) return reject(err);

                let output = '';
                let error = '';

                stream.on('data', data => {
                    output += data.toString();
                });

                stream.stderr.on('data', data => {
                    error += data.toString();
                });

                // change: check exit code
                stream.on('close', (code) => {
                    conn.end();

                    if (code === 0) {
                        resolve({ output, error });
                    } else {
                        reject(new Error(error || `Command failed with code ${code}`));
                    }
                });
            });
        });

        // small safe wrapper
        conn.on('error', (err) => reject(err));
        conn.connect({
            host: process.env.EC2_HOST,
            username: process.env.EC2_USER,
            privateKey: fs.readFileSync(process.env.EC2_SSH_KEY_PATH)
        });
    });
}


export { Tool, ToolRegistry, EmailSenderTool, WhatsAppSenderTool, WebSearchTool, TerminalTool, DeployTool };