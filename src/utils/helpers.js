export function getRandomHex() {
    return `#${Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0")}`;
}

export function getRandomDuckConfig() {
    return {
        body: getRandomHex(),
        beak: getRandomHex(),
    };
}

export function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
