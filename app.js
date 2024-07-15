const express = require('express');
const axios = require('axios');
const session = require('express-session');
require('dotenv').config();

const app = express();
const port = 3000;

app.use(express.static('views'));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html');
});

app.get('/profile', (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Unauthorized');
    }

    res.sendFile(__dirname + '/views/profile.html');
});

app.get('/auth/meta', (req, res) => {
    const redirectUri = encodeURIComponent(process.env.REDIRECT_URI);
    const clientId = process.env.META_CLIENT_ID;
    const state = req.sessionID;

    const authUrl = `https://www.facebook.com/v10.0/dialog/oauth?client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&scope=public_profile`;

    res.redirect(authUrl);
});

app.get('/auth/meta/callback', async (req, res) => {
    const code = req.query.code;
    const state = req.query.state;

    if (state !== req.sessionID) {
        return res.status(403).send('Invalid state parameter');
    }

    try {
        const tokenResponse = await axios.get('https://graph.facebook.com/v10.0/oauth/access_token', {
            params: {
                client_id: process.env.META_CLIENT_ID,
                redirect_uri: process.env.REDIRECT_URI,
                client_secret: process.env.META_CLIENT_SECRET,
                code: code,
            },
        });

        const accessToken = tokenResponse.data.access_token;

        const profileResponse = await axios.get('https://graph.facebook.com/me', {
            params: {
                fields: 'id,name',
                access_token: accessToken,
            },
        });

        const profile = profileResponse.data;

        req.session.user = {
            id: profile.id,
            name: profile.name,
        };

        res.cookie('session_id', req.sessionID, { httpOnly: true });

        console.log('Logged in as:', profile.name);

        res.redirect('/profile');

    } catch (error) {
        console.error(error.response ? error.response.data : error.message);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.clearCookie('session_id');
    res.redirect('/');
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
