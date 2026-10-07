const axios = require('axios')

const BASE_URL = 'https://nekobt.to/api/v1'

const SORT = {
    BEST: 'best',
    LATEST: 'latest',
    OLDEST: 'oldest',
    SEEDERS: 'seeders',
    LEECHERS: 'leechers',
    DOWNLOADS: 'downloads',
    COMMENTS: 'comments',
    FILESIZE: 'filesize'
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

function formatSize(bytes) {
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
    let i = 0
    while (bytes >= 1024 && i < units.length - 1) {
        bytes /= 1024
        i++
    }
    return `${bytes.toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

async function getWithRetry(url, config, tries = 3) {
    for (let i = 0; i < tries; i++) {
        try {
            return await axios.get(url, config)
        } catch (err) {
            const status = err.response?.status
            const last = i === tries - 1
            if (last) throw err
            if (status === 429) {
                const wait = err.response.data?.retry_after || 2
                await sleep(wait * 1000)
            } else if (status >= 500) {
                await sleep(1000 * (i + 1))
            } else {
                throw err
            }
        }
    }
}

async function searchNekoBT(query, opts = {}) {
    const {
        sort = SORT.SEEDERS,
        order = 'desc',
        limit = 50,
        offset = 0
    } = opts

    const sortBy = order === 'asc' && ![SORT.BEST, SORT.LATEST, SORT.OLDEST].includes(sort)
        ? `${sort}_asc`
        : sort

    const params = {
        query,
        limit,
        offset: offset > 0 ? offset : undefined,
        sort_by: sortBy
    }

    const res = await getWithRetry(`${BASE_URL}/torrents/search`, {
        params,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    })

    if (res.data?.error) throw new Error(res.data.message)

    const items = res.data?.data?.results || []
    console.log(`[nekobt] got ${items.length} results`)

    return items.map(item => ({
        id: item.id,
        title: item.title,
        link: `https://nekobt.to/torrents/${item.id}`,
        torrentUrl: `${BASE_URL}/torrents/${item.id}/download?public=true`,
        magnet: item.magnet,
        size: formatSize(parseInt(item.filesize) || '0', 10),
        seeders: parseInt(item.seeders || '0', 10),
        leechers: parseInt(item.leechers || '0', 10),
        downloads: parseInt(item.completed || '0', 10),
        infoHash: item.infohash,
        importedFromNyaa: item.imported || null,
        nyaaUploadTime: item.nyaa_upload_time
            ? new Date(parseInt(item.nyaa_upload_time, 10)).toISOString()
            : null,
        source: "nekobt"
    }))
}

function toMagnet(infoHash, title) {
    const trackers = [
        'udp://tracker.opentrackr.org:1337/announce',
        'udp://tracker.openbittorrent.com:6969/announce',
        'udp://exodus.desync.com:6969/announce',
        'udp://tracker.torrent.eu.org:451/announce'
    ]
    const tr = trackers.map(t => `&tr=${encodeURIComponent(t)}`).join('')
    return `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(title)}${tr}`
}

module.exports = { searchNekoBT, toMagnet, SORT }