const axios = require('axios')

const MAPPING_URL = 'https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json'

// Map<imdbId, entry[]>  -  built once at startup
let imdbIndex = null
let loadPromise = null

async function loadMapping() {
    console.log('[animeMap] fetching mapping dataset...')
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

    console.log(`[animeMap] indexed ${index.size} unique imdb ids from ${entries.length} entries`)
    return index
}

// Call once at addon startup - subsequent calls reuse the same in-flight/resolved promise
function ensureLoaded() {
    if (!loadPromise) {
        loadPromise = loadMapping().catch(err => {
            console.error('[animeMap] failed to load mapping dataset:', err.message)
            loadPromise = null // allow retry on next call
            throw err
        })
    }
    return loadPromise
}

// Resolves an imdb id (+ optional season, from Cinemeta's tt...:season:episode id)
// to the matching anime-lists entry. Disambiguates multi-cour shows that share
// one imdb id by matching season.tvdb (falls back to season.tmdb, then first entry).
async function resolveImdbToAnime(imdbId, season) {
    imdbIndex = await ensureLoaded()
    const candidates = imdbIndex.get(imdbId)
    if (!candidates || candidates.length === 0) return null

    if (candidates.length === 1 || season == null) {
        console.log(`[animeMap] resolving ${imdbId}: single candidate or no season provided`)
        return candidates[0]
    }

    console.log(`[animeMap] resolving ${imdbId} season ${season}: ${candidates.length} candidates`)
    candidates.forEach((c, i) => {
        console.log(`  [${i}] tvdb=${c.season?.tvdb}, tmdb=${c.season?.tmdb}, name=${c.name}, kitsu_id=${c.kitsu_id}`)
    })

    // Prefer TVDB matching (more reliable than TMDB). Fall back to first entry if no strong match.
    const bySeason = candidates.find(c => c.season?.tvdb === season)

    const result = bySeason || candidates[0]
    console.log(`[animeMap] matched to: tvdb=${result.season?.tvdb}, tmdb=${result.season?.tmdb}, name=${result.name}, kitsu_id=${result.kitsu_id}`)
    return result
}

module.exports = { resolveImdbToAnime }