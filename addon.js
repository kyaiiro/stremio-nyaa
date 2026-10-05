const { types } = require('node:util')
const { addonBuilder, serveHTTP } = require('stremio-addon-sdk')
const { resolveImdbToAnime } = require('./animeMap')
const { searchNyaa } = require('./nyaa')
const { parseEpisode, parseQuality, isBatch } = require('./parse')

const PREFERRED_QUALITY = '1080p' // will become a config option later

const manifest = {
    id: 'org.kyaiiro.nyaa-stremio',
    version: '0.4.0',
    name: 'nyaa',
    description: 'Streaming from nyaa.si for stremio',
    resources: ['stream'],
    types: ['series', 'movie'],
    catalogs: [],
    idPrefixes: ['kitsu', 'tt']
}

const builder = new addonBuilder(manifest)

builder.defineStreamHandler(async ({ type, id }) => {
    if (!id.startsWith('tt')) {
        return { streams: [] }
    }

    const [imdbID, season, episode] = id.split(':')
    console.log('Type:', type)
    console.log('ID:', imdbID)
    console.log('Season', season)
    console.log('Episode', episode)

    try {
        entry = await resolveImdbToAnime(imdbID, season)
    } catch(err) {
        console.error('[error] anime-list mapping lookup failed:', err.message)
        return { streams: [] }
    }

    if (!entry || !entry.title) {
        console.log(entry)
        console.error('[error] no usable animeMap entry/title found')
        return { streams: [] }
    }

    const title = entry?.title
    if (!title) {
        console.error('[error] no usable title found')
        return { streams: [] }
    }

    const effectiveSeason = season ?? 1

    let searchQuery = title
    if (episode) {
        searchQuery = `${title} S${String(effectiveSeason).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
    }
    console.log(`[nyaa] searching: "${searchQuery}"`)
    let results = await searchNyaa(searchQuery)
    
    let matches
    if (type === 'movie' || episode === null) {
        matches = results.filter(r => !isBatch(r.title) && r.infoHash)
    } else {
        matches = results.filter(r => {
            if (isBatch(r.title)) return false
            const ep = parseEpisode(r.title)
            return ep === Number(episode) && r.infoHash
        })
    }

    matches.sort((a, b) => {
        const aPerf = parseQuality(a.title) === PREFERRED_QUALITY ? 1 : 0
        const bPerf = parseQuality(b.title) === PREFERRED_QUALITY ? 1 : 0
        if (aPerf !== bPerf) return bPerf - aPerf
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