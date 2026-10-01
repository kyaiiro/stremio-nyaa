const axios = require('axios')
const NodeCache = require('node-cache')

const titleCache = new NodeCache({ stdTTL: 3600 }) // titles don't change, cache an hour

// Resolves a Kitsu anime id to its canonical title and start year.
// Kitsu's JSON:API returns multiple title variants; canonicalTitle is
// usually the romaji form, which tends to match nyaa release naming best.
async function getKitsuTitle(kitsuId) {
    const cached = titleCache.get(kitsuId)
    if (cached) {
        console.log(`[kitsu] title cache HIT for ${kitsuId}: ${cached.title}`)
        return cached
    }

    console.log(`[kitsu] fetching title for kitsu id ${kitsuId}`)
    const res = await axios.get(`https://kitsu.io/api/edge/anime/${kitsuId}`, {
        timeout: 10000
    })

    const attrs = res.data?.data?.attributes
    if (!attrs) throw new Error(`No attributes returned for kitsu id ${kitsuId}`)

    const title = attrs.canonicalTitle || attrs.titles?.en || attrs.titles?.en_jp
    if (!title) throw new Error(`No usable title found for kitsu id ${kitsuId}`)

    const year = attrs.startDate ? new Date(attrs.startDate).getFullYear() : null
    const result = { title, year }
    
    console.log(`[kitsu] resolved kitsu:${kitsuId} -> "${title}" (${year})`)
    titleCache.set(kitsuId, result)
    return result
}

module.exports = { getKitsuTitle }