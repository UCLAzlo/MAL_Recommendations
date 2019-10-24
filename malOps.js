// Request-Promises and Rate Limiting
// Rate-Limiting set to abide by MAL and Jikan Limits
const rp = require("request-promise-native");
const RateLimiter = require("request-rate-limiter");
const limiter = new RateLimiter({
    rate: 10,
    interval: 40,
    backoffCode: 429,
    backoffTime: 5,
    maxWaitingTime: 12000
});

// body parser
// const bodyParser = require("body-parser");
// app.use(bodyParser.json());

//Postgres operations
const db = require("./dbOps");

//
// Use Jikan API to retrieve user anime list
//
const retrieveUserAnimeList = user => {
    let options = {
        uri: "https://api.jikan.moe/v3/user/" + user + "/animelist/completed",
        json: true
    };
    return limiter.request(options).then(list => {
        let allAnime = [];
        list.body.anime.forEach(anime => {
            allAnime.push({
                mal_id: anime.mal_id,
                score: anime.score,
                title: anime.title
            });
        });
        animeJSON = JSON.stringify(allAnime);
        return db.insertList(user, animeJSON);
    });
};

//
// Use Jikan API to populate anime database based on user anime list
//
const populateAnimeDB = user => {
    //select user list from db
    let animeList = [];
    return (
        db
            .selectUserAnime(user)
            .then(res => {
                console.log("GETTING ANIME DETAILS");
                animeList = res.rows[0].list;
                let promises = [];
                //for each anime in list, populate full details in anime db
                animeList.forEach(anime => {
                    let options = {
                        uri: "https://api.jikan.moe/v3/anime/" + anime.mal_id,
                        json: true
                    };
                    promises.push(limiter.request(options));
                });
                console.log("ASSEMBLED ANIME PROMISES");
                return Promise.all(promises);
            })
            .then(animeListDetails => {
                console.log("VALIDATING DETAILS");
                let promises = [];
                animeListDetails.forEach(anime => {
                    let animeObject = {};
                    animeObject["id"] = anime.body.mal_id;
                    animeObject["title"] = anime.body.title;
                    animeObject["score"] = anime.body.score;
                    animeObject["popularity"] = anime.body.popularity;
                    animeObject["members"] = anime.body.members;
                    animeObject["favorites"] = anime.body.favorites;
                    animeObject["image"] = anime.body.image_url;

                    let objectGenres = [];
                    anime.body.genres.forEach(genre => {
                        objectGenres.push(genre.mal_id);
                    });
                    animeObject["genres"] = objectGenres;
                    promises.push(db.insertAnime(animeObject));
                });

                return Promise.all(promises);
            })
            //request user recommendations for each anime
            .then(res => {
                console.log("MAKING RECS");
                let promises = [];
                animeList.forEach(anime => {
                    promises.push(updateRecommendations(anime));
                });
                return Promise.all(promises);
            })
    );
    // .then(res => {
    //     return Promise.resolve(1);
    // })
    // .catch(err => {
    //     console.log(err);
    // });
};

const updateRecommendations = anime => {
    let options = {
        uri:
            "https://api.jikan.moe/v3/anime/" +
            anime.mal_id +
            "/recommendations",
        json: true
    };
    return limiter.request(options).then(recDetails => {
        let recs = [];
        recDetails.body.recommendations.forEach(rec => {
            if (rec.recommendation_count > 3) {
                recs.push({
                    mal_id: rec.mal_id,
                    count: rec.recommendation_count
                });
            }
        });
        let recsJSON = JSON.stringify(recs);
        let recObject = {
            recommendations: recsJSON,
            id: anime.mal_id
        };
        return db.updateAnimeRecs(recObject);
    });
};

const getRecommendations = user => {
    //select user list from db
    showRecs = [];
    weightedRecs = [];

    db.selectUserAnime(user)
        .then(res => {
            let promises = [];
            let animeList = res.rows[0].list;
            animeList.forEach(anime => {
                showRecs.push({
                    id: anime.mal_id,
                    userScore: anime.score
                });
                promises.push(db.selectSpecAnime(anime.mal_id));
            });

            return Promise.all(promises);
        })
        .then(animeList => {
            //combine show recommendation data + user score
            animeList.forEach(anime => {
                showRecs.forEach(show => {
                    if (anime.rows[0].id == show.id) {
                        show.recommendations = anime.rows[0].recommendations;
                    }
                });
            });

            //construct new weightedRecs list
            //TODO Optimize this N^3 insert and lookup
            showRecs.forEach(show => {
                show.recommendations.forEach(rec => {
                    temp = {
                        id: rec.mal_id,
                        weight: rec.count * show.userScore
                    };
                    found = false;
                    weightedRecs.forEach(i => {
                        if (temp.id == i.id) {
                            i.weight += rec.count * show.userScore;
                            found = true;
                        }
                    });
                    if (found == false) {
                        weightedRecs.push(temp);
                    }
                });
            });

            //remove any recs which have already been watched
            animeList.forEach(anime => {
                weightedRecs = weightedRecs.filter(
                    rec => rec.id !== anime.rows[0].id
                );
            });

            weightedRecs.sort(compareRecs);
            return weightedRecs;
        })
        .catch(err => {
            console.log(err);
        });
};

const compareRecs = (a, b) => {
    if (a.weight > b.weight) {
        return -1;
    } else {
        return 1;
    }
};

module.exports = {
    retrieveUserAnimeList,
    populateAnimeDB,
    updateRecommendations,
    getRecommendations
};
