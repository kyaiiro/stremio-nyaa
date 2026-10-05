const axios = require('axios')
const xml2js = require('xml2js')

const CATAGORIES = {
    ALL: '0_0',
    ANIME: '1_0',
    ANIME_ENGLISH: '1_2',
    ANIME_RAW: '1_4',
    ANIME_NON_ENGLISH: '1_3'
}

const FILTERS = {
    NONE: 0,
    NO_REMAKES: 1,
    TRUSTED_ONLY: 2
}

async function searchNyaa(query, opts = {}) {
    const {
        catagory = CATAGORIES.ANIME,
        filter = FILTERS.NONE,
        sort = 'seeders',
        order = 'desc'
    } = opts

    const url = 'https://nyaa.si/?page=rss'
    const res = await axios.get(url, {
        params: {
            q: query,
            c: catagory,
            f: filter,
            s: sort,
            o: order
        }
    })

    const parsed = await xml2js.parseStringPromise(res.data)
    const items = parsed?.rss?.channel?.[0]?.item || []

    console.log(`[nyaa] got ${items.length} results`)
    return items.map(item => ({
        title: item.title?.[0],
        link: item.link?.[0],
        torrentUrl: item.guid?.[0]?._ || item.guid?.[0],
        pubDate: item.pubDate?.[0],
        size: item['nyaa:size']?.[0],
        seeders: parseInt(item['nyaa:seeders']?.[0] || '0', 10),
        leechers: parseInt(item['nyaa:leechers']?.[0] || '0', 10),
        downloads: parseInt(item['nyaa:downloads']?.[0] || '0', 10),
        infoHash: item['nyaa:infoHash']?.[0],
        catagory: item['nyaa:catagory']?.[0],
        trusted: item['nyaa:trusted']?.[0] === 'Yes',
        remake: item['nyaa:remake']?.[0] === 'Yes'
    }))
}

function toMagnet(infoHash, title) {
    const trackers = [
        'udp://tracker.opentracker.org:1337/announce',
        'udp://tracker.openbittorrent.com:6969/announce',
        'udp://exodus.desync.com:6969/announce',
        `udp://tracker.torrent.eu.org:451/announce`
    ]
    const tr = trackers.map(t => `&tr=${encodeURIComponent(t)}`).join('')
    return `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(title)}${tr}`
}

module.exports = { searchNyaa, toMagnet, CATAGORIES, FILTERS }