class Executor {
    constructor(toolRegistry, opts = {}) {
        this.registry = toolRegistry;
        this.maxRetries = opts.maxRetries || 2;
        this.timeoutMs = opts.timeoutMs || 60000;
    }

    async executePlan(userId, steps, context = {}) {
        const state = {};
        for (const step of steps || []) {
            const tool = this.registry?.get(step.tool);
            if (!tool) {
                return { ok: false, error: `tool_not_registered: ${step.tool}` };
            }

            // if (!this.registry.userHasPermission(userId, tool.permission)) {
            //     return { ok: false, error: `permission_denied for tool ${tool.name}` };
            // }

            const input = this._renderInput(step.input, state);

            let attempt = 0;
            let out = null;
            while (attempt <= this.maxRetries) {
                try {
                    out = await this._callWithTimeout(tool, input, context, this.timeoutMs);
                    if (out && out.ok) break;
                    attempt++;
                    if (attempt > this.maxRetries) break;
                } catch (err) {
                    attempt++;
                    if (attempt > this.maxRetries) {
                        out = { ok: false, error: 'unhandled_error ' + err.message };
                        break;
                    }
                }   
            }

            const key = step.as || step.tool;
            state[key] = out;
            step.result = out && out.ok ? out.result : null;
            step.status = out && out.ok ? 'completed' : 'failed';
            step.error = out && out.error;

            if (!out || out.ok === false) {
                return { ok: false, error: `step_failed: ${key}`, detail: out };
            }
        }
        return { ok: true, state };
    }

    _renderInput(input, state) {
        const rendered = JSON.parse(JSON.stringify(input), (k, v) => {
            if (typeof v === 'string' && v.includes('{{') && v.includes('}}')) {
                return v.replace(/\{\{(.+?)\}\}/g, (_, path) => {
                    try {
                        return path.split('.').reduce((acc, p) => (acc ? acc[p] : undefined), state) || '';
                    } catch {
                        return '';
                    }
                });
            }
            return v;
        });
        return rendered;
    }

    _callWithTimeout(tool, input, context, timeoutMs) {
        return new Promise((resolve, reject) => {
            let finished = false;
            const timer = setTimeout(() => {
                if (!finished) {
                    finished = true;
                    reject(new Error('tool_timeout'));
                }
            }, timeoutMs);

            tool.call(input, context)
                .then(res => {
                    if (finished) return;
                    finished = true;
                    clearTimeout(timer);
                    resolve(res);
                })
                .catch(err => {
                    if (finished) return;
                    finished = true;
                    clearTimeout(timer);
                    reject(err);
                });
        });
    }
}

export { Executor };