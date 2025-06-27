window.UTILS = {
    getCurrentPlatform() {
        const href = window.location.href;
        if (href.includes('www.ic.net.cn')) {
            return 'jyw';
        } else if (href.includes('hqew.com')) {
            return 'hqw';
        }

        return 'unknown';
    }
}