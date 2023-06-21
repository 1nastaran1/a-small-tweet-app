var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var neo4j = require('neo4j-driver');
const { exit } = require('process');
const date = new Date();
var app = express();

//View Engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

var driver = neo4j.driver('bolt://localhost', neo4j.auth.basic('neo4j', '12345678'));
var session = driver.session();

app.get('/login', function (req, res) {
    res.render('login');
});
app.get('/signup', function(req , res){
    res.render('signup');
});
app.post('/followers', function (req, res) {
    var username = req.body.username;
    session
        .run(`MATCH ((a:user{name: $username})-[Followed]->(b:user)) RETURN b`, { username: username })
        .then(function (result) {
            var followerArr = [];
            result.records.forEach(function (record) {
                followerArr.push({
                    name: record._fields[0].properties.name,
                    bio: record._fields[0].properties.bio
                });

            });
            res.render('follower', { followers: followerArr })
        })
        .catch(function (err) {
            console.log(err);
        });


});
app.post('/followings', function (req, res) {
    var username = req.body.username;
    session
        .run(`MATCH ((a:user{name: $username})<-[Followed]-(b:user)) RETURN b`, { username: username })
        .then(function (result) {
            var followingArr = [];
            result.records.forEach(function (record) {
                followingArr.push({
                    name: record._fields[0].properties.name,
                    bio: record._fields[0].properties.bio
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
    var username = req.body.username;
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
    
})
app.post('/create-user', async function(req , res){
    var username = req.body.username;
    var password = req.body.password;
    var bio = req.body.bio;
    var email = req.body.email;
    var phone = req.body.phone;
    var index = 0;
    await session
        .run(`CREATE (n:user{name:$username, bio:$bio, phone:$phone, email:$email, password:$password}) RETURN n`,{
            password:password,
            username:username,
            bio:bio,
            phone:phone,
            email:email
        })
        .catch(function (err) {
            console.log(err);
            index = 1;
            console.log(index)
        });
    console.log(index)
    if(index){
        res.render('signup');
    }
    else{
        res.render('login');
    }
        
    
});
app.post('/account', function (req, res) {
    var username = req.body.username;
    var password = req.body.password;
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

app.listen(3000);
console.log("started");

module.exports = app;
