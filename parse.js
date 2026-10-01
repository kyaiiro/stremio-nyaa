function isBatch(title) {
    return /\b(batch|complete)\b/i.test(title) || /\b\d{1,5}\s*-\s*\d{1,5}\b/.test(title)
}

function parseEpisode(title) {
    if (isBatch(title)) return null

    let clean = title
        .replace(/^\[[^\]]+\]\s*/, '')
        .replace(/\[[A-F0-9]{8}\]\s*$/i, '')
        .replace(/\((19|20)\d{2}\)/, '')

    const patterns = [
        /-\s*(\d{1,5})(?:v\d)?\s*(?:\[|\(|$)/,
        /\bS\d{1,2}E(\d{1,5})\b/i,
        /\bE(?:P|p)?(\d{1,5})\b/,
        /#(\d{1,5})\b/,
        /\b(\d{1,5})(?:v\d)?\s*(?:\[|\()/,
    ]

    for (const pattern of patterns) {
        const match = clean.match(pattern)
        if (match) return parseInt(match[1], 10)
    }
    return null
}

function parseQuality(title) {
    const match = title.match(/(480|720|1080|2160)p/)
    return match ? match[1] + 'p' : null
}

module.exports = { parseEpisode, parseQuality, isBatch }