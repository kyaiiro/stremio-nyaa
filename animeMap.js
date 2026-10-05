const axios = require('axios')
const MAPPING_URL = 'https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json'

let imdbIndex = null
let loadPromise = null

async function getKitsuTitle(kitsuID) {
    const res = await axios.get(`https://kitsu.io/api/edge/anime/${kitsuID}`, {
        timeout: 10000
    })

    const attrs = res.data?.data?.attributes
    if (!attrs) throw new Error(`No attributes returned for kitsu id ${kitsuID}`)
    
    return attrs.canonicalTitle || attrs.titles?.en || attrs.titles?.en_jp
}

async function loadMapping() {
    const res = await axios.get(MAPPING_URL, { timeout: 30000 })
    const entries = res.data

    const index = new Map()
    for (const entry of entries) {
        const imdbIDs = entry.imdb_id
        if (!imdbIDs) continue
        const ids = Array.isArray(imdbIDs) ? imdbIDs : [imdbIDs]
        for (const imdbID of ids) {
            if (!index.has(imdbID)) index.set(imdbID, [])
                index.get(imdbID).push(entry)
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

async function resolveImdbToAnime(imdbID, season) {
    imdbIndex = await ensureLoaded()
    const candidates = imdbIndex.get(imdbID)
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