const express = require('express');
const { download } = require('./downloader');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const os = require('os');

// Middleware to parse JSON bodies
app.use(express.json());

app.post('/download/browser', (req, res) => {
    try {
        console.log(req.body);
        const { name, url } = req.body;
        download(url, { filename: path.join(os.homedir(), 'Documents/Apollo Downloads/', name + '.mp4') }).catch(error => {
            console.error('Error:', error);
            // res.status(500).json({ error: 'Internal server error' });
        });
        res.json({ message: 'Data received' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 