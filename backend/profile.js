const express = require('express');
const fileUpload = require('express-fileupload');
const expressFileUpload = require('express-fileupload')
const path = require('path');

const assestsFolder = path.join(__dirname, "assets");
const router = express.Router();

router.use(fileUpload())

router.post('/', (req, res) => {
    const { receipt } = req.files;
    try {
        receipt.mv(path.join(assestsFolder, receipt.name));
        res.status(200).json({ message: 'ok' });
    }
    catch{
        res.status(500).json({ message: e.message })
    }
})

module.exports = router;