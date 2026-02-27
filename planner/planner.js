import OpenAi from 'openai';
import dotenv from 'dotenv';
dotenv.config(); // load .env
const openai = new OpenAi({ apiKey: process.env.OPENAI_API_KEY });
class Planner {
    constructor(availableTools = []) {
        this.availableTools = availableTools;
    }
    async plan(userRequest, reattempt = false, rephrase = false, lastOutputs = null, userNewRequest = null, lastSteps = null) {
        userRequest = userRequest.toLowerCase();

        let prompt = '';

        console.log("REATTEMPT:", reattempt);
        console.log("REPHRASE:", rephrase);

        let toolNames;
        if (this.availableTools instanceof Map) {
            toolNames = Array.from(this.availableTools.values()).map(t => {
                return JSON.stringify({ name: t.name, description: t.description })
            }).join(", ");
        }
        console.log("TOOLNAMES:", toolNames);

        if (rephrase) {
            prompt = `You are a helpful assistant. You are given a user request: "${userRequest}". You previously planned a sequence of tools to execute to answer the user's request, but the user said ${userNewRequest} and rephrased the request. Here are the last steps you planned: ${JSON.stringify(lastSteps)}. You need to plan a new sequence of tools to execute to answer the user's new request. The tools you can use are: ${toolNames}. You should return a JSON plan, which is a list of steps, each of which is an object with "tool" and "input" properties. The "input" property is the input to the tool. The "tool" is the name of the tool to use. If you cannot plan a sequence of tools, return "null". You can only plan tools that you can use. Do not plan tools that you cannot use. Do not plan steps that are not in the user's new request. Do not plan steps that are not in your capabilities. Return a JSON plan that is a list of steps.
        
        and here is an example plan:
        { steps: [
            { tool: 'weather', input: { location: '28.61,77.21' }, as: 'weather1' },
            { tool: 'search', input: { query: 'what to wear for this location' }, as: 'search1' },
            { tool: 'calculator', input: { expr: '23 * (4 + 2) / 3' }, as: 'calc1' },
            { tool: 'db_fetch', input: { table: 'users', filter: { id: 1 } }, as: 'user1' },
            { tool: 'terminal', input: { cmd: 'ls -la' }, as: 'term1' },
            { tool: 'send_email', input: { to: 'prince@example.com', subject: 'Planning failed', body: 'Please try again' }, as: 'email1' }
            { tool: 'deploy_repo', input: { repoUrl: 'https://github.com/prince-chrismc/test-repo' }, as: 'deploy1' }
        ]}`;
        } else if (reattempt) {
            prompt = `You are a helpful assistant. You are given a user request: "${userRequest}". You previously attempted to plan a sequence of tools to execute to answer the user's request, but it failed. Here are the last outputs from your previous attempt: ${JSON.stringify(lastOutputs)}. You need to plan a new sequence of tools to execute to answer the user's request. The tools you can use are: ${toolNames}. You should return a JSON plan, which is a list of steps, each of which is an object with "tool" and "input" properties. The "input" property is the input to the tool. The "tool" is the name of the tool to use. If you cannot plan a sequence of tools, return "null". You can only plan tools that you can use. Do not plan tools that you cannot use. Do not plan steps that are not in the user's request. Do not plan steps that are not in your capabilities. Return a JSON plan that is a list of steps.
            and if you cannot improve the plan, return "null".
        
        and here is an example plan:
        { steps: [
            { tool: 'weather', input: { location: '28.61,77.21' }, as: 'weather1' },
            { tool: 'search', input: { query: 'what to wear for this location' }, as: 'search1' },
            { tool: 'calculator', input: { expr: '23 * (4 + 2) / 3' }, as: 'calc1' },
            { tool: 'db_fetch', input: { table: 'users', filter: { id: 1 } }, as: 'user1' },
            { tool: 'terminal', input: { cmd: 'ls -la' }, as: 'term1' },
            { tool: 'send_email', input: { to: 'prince@example.com', subject: 'Planning failed', body: 'Please try again' }, as: 'email1' }
            { tool: 'deploy_repo', input: { repoUrl: 'https://github.com/prince-chrismc/test-repo' }, as: 'deploy1' }
        ]}`;
        } else {
            prompt = `You are a helpful assistant. You are given a user request: "${userRequest}". You need to plan a sequence of tools to execute to answer the user's request. The tools you can use are: ${toolNames}. You should return a JSON plan, which is a list of steps, each of which is an object with "tool" and "input" properties. The "input" property is the input to the tool. The "tool" is the name of the tool to use. If you cannot plan a sequence of tools, return "null". You can only plan tools that you can use. Do not plan tools that you cannot use. Do not plan steps that are not in the user's request. Do not plan steps that are not in your capabilities. Return a JSON plan that is a list of steps.
        
        and here is an example plan:
        { steps: [
            { tool: 'weather', input: { location: '28.61,77.21' }, as: 'weather1' },
            { tool: 'search', input: { query: 'what to wear for this location' }, as: 'search1' },
            { tool: 'calculator', input: { expr: '23 * (4 + 2) / 3' }, as: 'calc1' },
            { tool: 'db_fetch', input: { table: 'users', filter: { id: 1 } }, as: 'user1' },
            { tool: 'terminal', input: { cmd: 'ls -la' }, as: 'term1' },
            { tool: 'send_email', input: { to: 'prince@example.com', subject: 'Planning failed', body: 'Please try again' }, as: 'email1' }
            { tool: 'deploy_repo', input: { repoUrl: 'https://github.com/prince-chrismc/test-repo' }, as: 'deploy1' }
        ]}
    `;
        }

        const plan = await Planner.callLLM(prompt);
        // dummy for development
        // const plan = {
        //     steps: [
        //         { tool: 'search', input: { query: 'what to wear for this location' }, as: 'search1' },
        //         { tool: 'calculator', input: { expr: '23 * (4 + 2) / 3' }, as: 'calc1' },
        //         { tool: 'db_fetch', input: { table: 'users', filter: { id: 1 } }, as: 'user1' },
        //         { tool: 'terminal', input: { cmd: 'ls -la' }, as: 'term1' },
        //         { tool: 'send_email', input: { to: 'prince@example.com', subject: 'Planning failed', body: 'Please try again' }, as: 'email1' }
        //     ]
        // }
        // const plan = {
        //     steps: [
        //         { tool: 'deploy_repo', input: { repoUrl: 'https://github.com/vansh-choudhary01/RAG-Optimization' }, as: 'deploy1' }
        //     ]
        // };
        console.log("PLAN:");
        console.log(plan);
        return plan || null;

        // default: do a web search
        return { steps: [{ tool: 'search', input: { query: userRequest }, as: 'search1' }] };
    }

    static async callLLM(prompt) {
        try {
            const resp = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0,
                max_tokens: 500,
            });
            if (resp.choices.length > 0) {
                const plan = resp.choices[0].message.content;
                return JSON.parse(plan);
            } else {
                return null;
            }
        } catch (err) {
            console.error('LLM call error:', err);
            return null;
        }
    }
}

export { Planner };