const { addonBuilder, serveHTTP } = require('stremio-addon-sdk')
const NodeCache = require('node-cache')
const { searchNyaa } = require('./nyaa')
const { parseEpisode, parseQuality, isBatch } = require('./parse')
const { getKitsuTitle } = require('./kitsu')

const PREFERRED_QUALITY = '1080p' // will become a config option later

// cache nyaa search results per anime title for a few minutes, so
// requesting streams for consecutive episodes of the same show doesn't
// re-hit nyaa every time
const searchCache = new NodeCache({ stdTTL: 300 })

const manifest = {
    id: 'org.yourname.anilistsync',
    version: '0.3.0',
    name: 'AniList Sync (dev)',
    description: 'Stream-only addon: provides nyaa.si sources for Kitsu-catalog anime entries. Works like Torrentio - no separate catalog or search.',
    resources: ['stream'],
    types: ['series', 'movie'],
    catalogs: [], // intentionally empty - streams only, relies on other addons' catalogs
    idPrefixes: ['kitsu:']
}

const builder = new addonBuilder(manifest)

builder.defineStreamHandler(async ({ type, id }) => {
    console.log('[stream]', type, id)

    // id arrives as "kitsu:12345" (movie) or "kitsu:12345:5" (series episode)
    const parts = id.split(':') // ['kitsu', '12345', '5']
    const kitsuId = parts[1]
    const episode = parts[2] ? parseInt(parts[2], 10) : null

    if (!kitsuId) {
        console.log('[stream] malformed id, no kitsu id found:', id)
        return { streams: [] }
    }

    let title
    try {
        title = await getKitsuTitle(kitsuId)
    } catch (err) {
        console.error('[stream] kitsu title lookup failed:', err.message)
        return { streams: [] }
    }

    const cacheKey = kitsuId
    let results = searchCache.get(cacheKey)
    if (!results) {
        try {
            results = await searchNyaa(title)
            searchCache.set(cacheKey, results)
        } catch (err) {
            console.error('[stream] nyaa search failed:', err.message)
            return { streams: [] }
        }
    }

    let matches
    if (type === 'movie' || episode === null) {
        // no episode to match against - treat any non-batch single release as a candidate
        matches = results.filter(r => !isBatch(r.title) && r.infoHash)
    } else {
        matches = results.filter(r => {
            if (isBatch(r.title)) return false
            const ep = parseEpisode(r.title)
            return ep === episode && r.infoHash
        })
    }

    matches.sort((a, b) => {
        const aPref = parseQuality(a.title) === PREFERRED_QUALITY ? 1 : 0
        const bPref = parseQuality(b.title) === PREFERRED_QUALITY ? 1 : 0
        if (aPref !== bPref) return bPref - aPref
        return b.seeders - a.seeders
    })

    const streams = matches.slice(0, 10).map(r => ({
        title: `${r.title}\n👤 ${r.seeders} seeders | 💾 ${r.size}`,
        infoHash: r.infoHash
    }))

    console.log(`[stream] "${title}" ep=${episode}: ${matches.length} matches, returning ${streams.length}`)
    return { streams }
})

serveHTTP(builder.getInterface(), { port: 7000 })
console.log('Addon running at http://127.0.0.1:7000/manifest.json')