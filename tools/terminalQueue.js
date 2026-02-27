const MAX_CONCURRENT = 5;

let running = 0;
let queue = [];

export function runWithQueue(taskFn) {
    return new Promise((resolve, reject) => {
        queue.push({ taskFn, resolve, reject });
        processQueue();
    })
}

function processQueue() {
    if (running >= MAX_CONCURRENT) return;
    if (queue.length === 0) return;

    const { taskFn, resolve, reject } = queue.shift();
    running++;

    taskFn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
            running--;
            processQueue();
        })
}