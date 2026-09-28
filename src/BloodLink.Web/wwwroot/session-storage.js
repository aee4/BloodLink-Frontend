export function read(key) {
    return sessionStorage.getItem(key);
}

export function write(key, value) {
    sessionStorage.setItem(key, value);
}

export function clear(key) {
    sessionStorage.removeItem(key);
}
