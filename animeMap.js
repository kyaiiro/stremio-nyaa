const axios = require('axios')

const MAPPING_URL = 'https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json'

// Map<imdbId, entry[]>  -  built once at startup
let imdbIndex = null
let loadPromise = null

async function getKitsuTitle(kitsuId) {
    const res = await axios.get(`https://kitsu.io/api/edge/anime/${kitsuId}`, {
        timeout: 10000
    })

    const attrs = res.data?.data?.attributes
    if (!attrs) throw new Error(`No attributes returned for kitsu id ${kitsuId}`)

    return attrs.canonicalTitle || attrs.titles?.en || attrs.titles?.en_jp
}

async function loadMapping() {
    const res = await axios.get(MAPPING_URL, { timeout: 30000 })
    const entries = res.data

    const index = new Map()
    for (const entry of entries) {
        const imdbIds = entry.imdb_id
        if (!imdbIds) continue
        const ids = Array.isArray(imdbIds) ? imdbIds : [imdbIds]
        for (const imdbId of ids) {
            if (!index.has(imdbId)) index.set(imdbId, [])
            index.get(imdbId).push(entry)
        }
    }

    return index
}

function ensureLoaded() {
    if (!loadPromise) {
        loadPromise = loadMapping().catch(err => {
            loadPromise = null
            throw err
        })
    }
    return loadPromise
}

async function resolveImdbToAnime(imdbId, season) {
    imdbIndex = await ensureLoaded()
    const candidates = imdbIndex.get(imdbId)
    if (!candidates || candidates.length === 0) return null

    const selected = candidates.length === 1 || season == null
        ? candidates[0]
        : (candidates.find(c => c.season?.tvdb === season) || candidates[0])

    if (selected?.kitsu_id) {
        selected.title = await getKitsuTitle(selected.kitsu_id)
    }

    return selected
}

module.exports = { resolveImdbToAnime }