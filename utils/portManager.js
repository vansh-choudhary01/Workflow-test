let currentPort = parseInt(process.env.APP_BASE_PORT) || 3001;

export function getNextPort() {
    return currentPort++;
}