const axios = require('axios')
const NodeCache = require('node-cache')

const titleCache = new NodeCache({ stdTTL: 3600 }) // titles don't change, cache an hour

// Resolves a Kitsu anime id to its canonical title.
// Kitsu's JSON:API returns multiple title variants; canonicalTitle is
// usually the romaji form, which tends to match nyaa release naming best.
async function getKitsuTitle(kitsuId) {
    const cached = titleCache.get(kitsuId)
    if (cached) return cached

    const res = await axios.get(`https://kitsu.io/api/edge/anime/${kitsuId}`, {
        timeout: 10000
    })

    const attrs = res.data?.data?.attributes
    if (!attrs) throw new Error(`No attributes returned for kitsu id ${kitsuId}`)

    const title = attrs.canonicalTitle || attrs.titles?.en || attrs.titles?.en_jp
    if (!title) throw new Error(`No usable title found for kitsu id ${kitsuId}`)

    titleCache.set(kitsuId, title)
    return title
}

module.exports = { getKitsuTitle }