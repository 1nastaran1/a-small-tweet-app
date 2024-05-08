var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var neo4j = require('neo4j-driver');
const { exit } = require('process');
const date = new Date();
var app = express();
let alert = require('alert');
// var popup = require("popupS");
const notifier = require('node-notifier');
const store = require('store2')

//View Engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

var driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', '12345678'));
var session = driver.session();

const isAuthenticated = (req, res, next)=> {
    const user = store("username");
    if (!user) {
        res.redirect("/login");
    } else {
        req.username = user;
        next();
    }
}

app.get('/login', function (req, res) {
    res.render('login');
});
app.get('/signup', function(req , res){
    res.render('signup');
});
app.post('/followers', function (req, res) {
    // var username = req.body.username;
    const username = store('username');
    // const password = store('password');
    session
        .run(`MATCH ((a:user{name: $username})<-[:FOLLOW]-(b:user)) RETURN b`, { username: username })
        .then(function (result) {
            var followerArr = [];
            result.records.forEach(function (record) {
                followerArr.push({
                    name: record.get('b').properties.name,
                    bio: record.get('b').properties.bio
                });

            });
            res.render('follower', { followers: followerArr })
            console.log(followerArr[0].name);
        })
        .catch(function (err) {
            console.log(err);
        });


});
app.post('/followings', function (req, res) {
    // var username = req.body.username;

    const username = store('username');
    session
        .run(`MATCH ((a:user{name: $username})-[FOLLOW]->(b:user)) RETURN b`, { username: username })
        .then(function (result) {
            var followingArr = [];
            result.records.forEach(function (record) {
                followingArr.push({
                    name: record.get('b').properties.name,
                    bio: record.get('b').properties.bio
                });
            });
            res.render('following', { followings: followingArr })

        })
        .catch(function (err) {
            console.log(err);
        });

});
app.post('/create-tweet' ,async function(req , res){
    var text = req.body.tweet;
    // var username = req.body.username;
    const username = store('username');
    var tweetid = 0;
    var tweetDate = date.toISOString();
    await session
        .run('MATCH(t:Tweet) RETURN COUNT(*)')
        .then(function(result){
            tweetid = result.records[0]._fields[0].low +10;
        })
        .catch(function (err) {
            console.log(err);
        });
    await session
        .run(`CREATE (n:Tweet{text: $text , tweetid: $tweetid , date: $tweetDate})`,{text:text , tweetDate:tweetDate , tweetid:tweetid})
        .catch(function (err) {
            console.log(err);
        });
    await session
        .run(`MATCH (a:user), (b:Tweet)   
            WHERE a.name = $username AND b.tweetid = $tweetid  
            CREATE (a)-[: Posted ]->(b)   
            RETURN a,b `,{tweetid:tweetid , username:username})
        .catch(function (err) {
            console.log(err);
        });
        res.send('tweet added');
        // res.render("account")
        return;
    
})
// app.post('/create-user', async function(req , res){
//     var username = req.body.username;
//     var password = req.body.password;
//     var bio = req.body.bio;
//     var email = req.body.email;
//     var phone = req.body.phone;
//     var index = 0;
//     await session
//         .run(`CREATE (n:user{name:$username, bio:$bio, phone:$phone, email:$email, password:$password}) RETURN n`,{
//             password:password,
//             username:username,
//             bio:bio,
//             phone:phone,
//             email:email
//         })
//         .catch(function (err) {
//             console.log(err);
//             index = 1;
//             console.log(index)
//         });
//     console.log(index)
//     if(index){
//         res.render('signup');
//     }
//     else{
//         res.render('login');
//     }
        
    
// });

app.post('/create-user', async function(req, res) {
    var username = req.body.username;
    var password = req.body.password;
    var bio = req.body.bio;
    var email = req.body.email;
    var phone = req.body.phone;
    var location = req.body.location;
    var index = 0;
    await session
        .run(`CREATE (n:user{name:$username, bio:$bio, phone:$phone, email:$email, password:$password}) RETURN n`, {
            password: password,
            username: username,
            bio: bio,
            phone: phone,
            email: email
        })
        .catch(function(err) {
            console.log(err);
            index = 1;
            console.log(index);
        });
    await session
        .run(`CREATE (l:location{location:$location}) RETURN l`, {location: location})
        .catch(function(err) {
            console.log(err);
            index = 2;
            console.log(index);
        });
    await session
        .run(`MATCH (a:user), (l:location)   
            WHERE a.name = $username AND l.location = $location  
            CREATE (a)-[:livesin]->(l)   
            RETURN a,l `,{username:username , location: location})
        .catch(function (err) {
            console.log(err);
            index = 3;
            console.log(index);
        });
    console.log(index);
    if (index) {
        res.render('signup');
        return; // Add this line to stop the execution of the code
    } else {
        res.render('login');
    }
});
app.post('/account', function (req, res) {
    var username = req.body.username;
    var password = req.body.password;
    store("username", username);
    // store("password", password);
    session
        .run(`MATCH(n:user) WHERE n.name = $username AND n.password = $password return n`, { username: username  , password: password})
        .then(function (result) {
            if (result.records[0] == undefined) {
                res.send('user not find');
            }
            else {
                var user = result.records[0]._fields[0].properties;
                session
                    .run(`MATCH ((a:user{name: $username})-[Posted]->(b:Tweet)) RETURN b`, { username: username })
                    .then(function (result) {
                        var tweetArr = [];
                        result.records.forEach(function (record) {
                            tweetArr.push({
                                text: record._fields[0].properties.text
                            });
                        });
                        res.render('account', {
                            user: user,
                            tweets: tweetArr
                        });
                    })
                    .catch(function (err) {
                        console.log(err);
                    });

            }

        })
        .catch(function (err) {
            console.log(err);
        });




});

class User {
    constructor(name, bio) {
        this.name = name;
        this.bio = bio;
    }
}

class Following {
    constructor(name) {
        this.name = name;
    }
}

app.get('/users', isAuthenticated, async function (req, res) {
    try {
        const username = store('username');
        
        // Query to retrieve followings
        const followingsQuery = `MATCH (user1:user {name: $username})-[:FOLLOW]->(linkedUser:user)
                                RETURN linkedUser`;

        const followingsResult = await session.run(followingsQuery, { username: username });

        var followings = followingsResult.records.map(record => {
            var name = record.get('linkedUser').properties.name;
            return new Following(name);
        });

        console.log('Followings:', followings[0]);


        // Query to retrieve users

        // const usersQuery = 'MATCH (u:user) RETURN u';
        // const usersResult = await session.run(usersQuery);

        const usersQuery = 'MATCH (u:user) WHERE u.name <> $username RETURN u';
        const usersResult = await session.run(usersQuery, { username: username });


        var users = usersResult.records.map(record => {
            var name = record.get('u').properties.name;
            var bio = record.get('u').properties.bio;
            return new User(name, bio);
        });

        // Render the page with retrieved data
        res.render('users', { users: users, followings: followings });
    } catch (err) {
        console.log(err);
        res.status(500).send('Internal Server Error');
    }
});


// app.get('/users',isAuthenticated, async function (req, res) {
//     const username = store('username');
//     const query = `MATCH (user1:user {name: $username})-[:FOLLOW]->(linkedUser:user)
//                    RETURN linkedUser.name AS linkedUsername`;

//     var followings = [];

//     await session
//         .run(query, {username: username})
//         .then(function (result) {
//             result.records.forEach(function (record) {
//                 var name = record.get('linkedUsername');
//                 var following = new Following(name);
//                 followings.push(following);
//             });
//         })
//         .catch(function (err) {
//             console.log(err);
//         });


//     session
//         .run('MATCH (u:user) RETURN u')
//         .then(function (result) {
//             var users = [];
//             result.records.forEach(function (record) {
//                 var name = record.get('u').properties.name;
//                 var bio = record.get('u').properties.bio;
//                 var user = new User(name, bio);
//                 users.push(user);
//             });
//             res.render('users', { users: users, followings: followings });
  
//             // Redirect to the users page
//             res.redirect('/users');
//         })
//         .catch(function (err) {
//             console.log(err);
//         });
// });

app.post('/follow', isAuthenticated, async function(req, res) {
    //var follower = req.user.username; // Assuming the current user's username is available in req.user.username
    var followedUser = req.body.username; // The username entered in the form's text input
    const follower = req.username;

    const query = `MATCH (follower:user {name: $follower}), (followedUser:user {name: $followedUser})
    CREATE (follower)-[:FOLLOW]->(followedUser)`;
    
    await session.run(query, {followedUser: followedUser, follower: follower,})
    .then(() => {
      console.log('Relationship created successfully!');
    })
    .catch(function (err) {
        console.log(err);
    });


    res.redirect('/users'); // Redirect back to the users page after following
    
    // popup.alert({
    // content: 'user is successfully followed!'});

    notifier.notify({
        title: 'Follow message!',
        message: 'User is successfully followed!!',
        // icon: path.join(__dirname, 'icon.jpg'),
        sound: true,
        wait: true
      })

    // alert("user is successfully followed!")

  });


// app.get('/tweets', async function(req, res) {
//     try {
//         const result = await session.run('MATCH (u:user)-[:Posted]->(t:Tweet) RETURN u, t');
//         const data = result.records.map(record => {
//             const user = record.get('u').properties;
//             const tweet = record.get('t').properties;
//             return { user, tweet };
//         });
//         console.log(data);
//         res.render('tweets', { data: data });
//     } catch (err) {
//         console.log(err);
//         res.sendStatus(500);
//     }
// });


app.get('/userloc', async function(req, res) {
    try {
        const result = await session.run('MATCH (u:user)-[:livesin]->(l:location) RETURN u, l');
        const data = result.records.map(record => {
        //     const user = record.get('u').properties;
            const loc = record.get('l').properties;
            return  loc ;
        });
        console.log(data);
        // res.render('tweets', { data: data });
    } catch (err) {
        console.log(err);
        res.sendStatus(500);
    }
});

// app.post('/follow', function(req, res) {
//     var follower = req.user.username; // Assuming the current user's username is available in req.user.username
//     var followedUser = req.body.name; // The username entered in the form's text input
  
//     // Perform the follow action in your database or any other logic
//     // For example, you can store the relationship between the follower and the followedUser in your database
  
//     // Create a link between the follower and the followedUser
//     // Assuming you have a method to create a link between two users in your database
//     createLink(follower, followedUser);
  
//     res.redirect('/users'); // Redirect back to the users page after following
//   });

//   app.get('/users', function(req, res) {
//     var username = req.body.username || store('username');
  
//     // Pass the username to the users page
//     res.render('users', { username: username });
//   });

  app.post('/users', function(req, res) {
    var username = req.body.username;
  
    // Store the username in the browser's local storage
    // store('username', username);
  
    // Redirect to the users page
    res.redirect('/users');
  });

  // Assuming you are using Express.js
app.get('/get-username', function(req, res) {
    session
    .run('MATCH (u:user) RETURN u')
    .then(function (result) {
        var users = [];
        result.records.forEach(function (record) {
            var name = record.get('u').properties.name;
            var bio = record.get('u').properties.bio;
            var user = new User(name, bio);
            users.push(user);
        });
        res.render('users', { users: users });
        var username = req.body.username;

        // Store the username in the browser's local storage
        store('username', username);

        // Redirect to the users page
        res.redirect('/users');
    })
    .catch(function (err) {
        console.log(err);
    });
});

// app.get('/get_tweets', async function(req, res) {
//     try {
        
//         const result = await session.run('MATCH (u:user)-[:Posted]->(t:Tweet) RETURN u, t');
//         const data = result.records.map(record => {
//             const user = record.get('u').properties;
//             const tweet = record.get('t').properties;
//             return { user, tweet };
//         });
//         console.log(data);
//         res.render('tweets', { data: data});
        
//         var  username = req.body.username;
//         // Store the username in the browser's local storage
//         store('username', username);

//         // Redirect to the users page
//         res.redirect('/tweets');

//     } catch (err) {
//         console.log(err);
//         res.sendStatus(600);
//     }
// });

app.post('/tweets', function(req, res) {
    var username = req.body.username;
  
    // // Store the username in the browser's local storage
    // store('username', username);
  
    // Redirect to the users page
    res.redirect('/tweets');
  });

  class Likedtweets{
    constructor(tweetid, text) {
        this.tweetid = tweetid;
        this.text = text;
    }
  }

  app.get('/tweets', async function(req, res) {
    // const username = store('username');
    // try {
    //     const result = await session.run(`
    //         MATCH (u:user)-[:Posted]->(t:Tweet)
    //         OPTIONAL MATCH (u2:user)-[r:LIKES]->(t)
    //         WITH u, t, COUNT(r) AS likesCount
    //         RETURN u, t, likesCount
    //     `);

    //     const data = result.records.map(record => {
    //         const user = record.get('u').properties;
    //         const tweet = {
    //             ...record.get('t').properties,
    //             likesCount: record.get('likesCount').toNumber() || 0,
    //         };
    //         return { user, tweet };
    //     });

    //     res.render('tweets', { data: data });
    // } catch (err) {
    //     console.log(err);
    //     res.sendStatus(500);
    // }

    try {
        const username = store('username');
        
        // Query to retrieve likedtweets
        const query = `MATCH (user1:user {name: $username})-[:LIKES]->(tweet:Tweet)
                             RETURN tweet`;
    
        const likes = await session.run(query, { username: username });
    
        var likedtweets = likes.records.map(record => {
            var tweetid = record.get('tweet').properties.tweetid;
            var text = record.get('tweet').properties.text;
            return new Likedtweets(tweetid, text);
        });
    
        console.log('likedtweets:', likedtweets[0]);
    
    
        // Query to retrieve tweets
        const result = await session.run(`
                MATCH (u:user)-[:Posted]->(t:Tweet)
                OPTIONAL MATCH (u2:user)-[r:LIKES]->(t)
                WITH u, t, COUNT(r) AS likesCount
                RETURN u, t, likesCount
            `);
    
            const data = result.records.map(record => {
                const user = record.get('u').properties;
                const tweet = {
                    ...record.get('t').properties,
                    likesCount: record.get('likesCount').toNumber() || 0,
                };
                return { user, tweet };
            });
    
        // Render the page with retrieved data
        res.render('tweets', { data: data, likedtweets: likedtweets});
    } catch (err) {
        console.log(err);
        res.sendStatus(500);
    }
});


app.post('/tweets/tweet/:id/like', isAuthenticated, async function(req, res) {
	var username = req.username;
    var tweetid = parseInt(req.body.tweetid, 10); //req.params.id
    console.log("+++++++++++++++++++++++++++++++++++++++");
    console.log(username);
    console.log(typeof tweetid);
    await session
    .run('MATCH (u:user {name: $username}), (t:Tweet {tweetid: $tweetid}) ' +
        'MERGE (u)-[r:LIKES]->(t) RETURN u, r, t',
        { username, tweetid })
    .then(result => {
        console.log('like Relationship created successfully!');
        // Explicitly commit the transaction
    })
    .catch(function (err) {
        console.log(err);
    });

    res.redirect('/tweets');

  });

  
app.listen(3000);
console.log("started");

module.exports = app;
