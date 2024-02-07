const API_URL = 'https://api.scryfall.com/cards/search';
const MAX_QUERY_LENGTH = 1000;

/**
 * Construct (potentially) multiple queries to Scryfall to check if every card matches the provided base query. Due to
 * the MAX_QUERY_LENGTH, we may need to split this up.
 * @param baseQuery {string} Base query to start from
 * @param cards {string[]} Names of cards to check
 */
function constructQueries(baseQuery, cards) {
  const queries = [];

  let curCardChunk = '';
  for(const card of cards) {
    // Construct a new chunk for if we did add this card to the current query
    let newCardChunk = '';
    if(!curCardChunk) {
      newCardChunk = `!${card}`;
    } else {
      newCardChunk = `${curCardChunk} or !${card}`;
    }

    // If adding this card would make the query too long, add the previous query to our array & start building a new one
    const newQuery = encodeURIComponent(`${baseQuery} (${newCardChunk})`);
    if(newQuery.length >= MAX_QUERY_LENGTH) {
      const query = encodeURIComponent(`${baseQuery} (${curCardChunk})`); // that space and two parens is why we add 3
      queries.push(query);
      curCardChunk = `!${card}`;
    } else {
      // Otherwise, the new chunk is the current chunk
      curCardChunk = newCardChunk;
    }
  }

  if(curCardChunk) {
    const query = encodeURIComponent(`${baseQuery} (${curCardChunk})`); // that space and two parens is why we add 3
    queries.push(query);
  }

  return queries;
}

/**
 * Checks if the cards are part of the given Scryfall query. This assumes the query will not contain a name search,
 * because that would kinda break everything (and be rather pointless).
 * @param cards {string[]} The cards to look for
 * @param query {string} The query to search Scryfall with
 */
async function checkCards(cards, query) {
  const queries = constructQueries(query, cards);
  const missingCards = new Set(cards);
  const foundCards = [];
  for(const query of queries) {
    const resp = await fetch(`${API_URL}?q=${query}`);
    if(!resp.ok) {
      console.log(resp);
      setOutput(`There was an error trying to query Scryfall; check console for details`);
    }
    const data = await resp.json();
    if(data.status === 404) {
      continue; // No cards matched, keep going
    }
    const cardObjects = data.data;
    for(const cardObj of cardObjects) {
      missingCards.delete(cardObj.name.toLowerCase());
      foundCards.push(cardObj.name);
    }
  }

  if(missingCards.size === 0) {
    setOutput('All cards matched query.');
  } else if(missingCards.size === cards.length) {
    setOutput('No cards matched query.');
  } else {
    const missingCardsString = [...missingCards].join('\n');
    const foundCardsString = foundCards.join('\n');
    setOutput(`Mixed results.\n\nFound cards:\n${foundCardsString}\n\nMissing cards:\n${missingCardsString}`);
  }
}

function start() {
  document.getElementById('checkButton').addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    /** @type {string} */
    const query = document.getElementById('query').value;
    /** @type {string} */
    const cardListText = document.getElementById('cardList').value;
    const cards = cardListText
      .split('\n')
      .map((line) => {
        const match = line.match(/\d*x?\s*(.*)/);
        if(!match) return line;
        return match[1];
      })
      .map((card) => card.toLowerCase())
      .filter((card) => !!card);
    const cardSet = new Set(cards);
    await checkCards([...cardSet], query);
  });
}

function setOutput(text) {
  document.getElementById('output').innerText = text;
}