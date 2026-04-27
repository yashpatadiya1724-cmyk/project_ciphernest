const express = require('express');
const { scanWebsite } = require('../controllers/webScanController');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  checkPhishing, analyzePassword, checkBreach, checkDomainReputation,
  scanPorts, analyzeIP, encryptText, generateHash, base64Tool,
  binaryConverter, jwtDecoder, performRecon, darkWebScan, sandbox,
  stripMetadata, getToolHistory, decodeHash
} = require('../controllers/toolsController');

router.post('/phishing', protect, checkPhishing);
router.post('/password', protect, analyzePassword);
router.post('/breach', protect, checkBreach);
router.post('/domain', protect, checkDomainReputation);
router.post('/port-scan', protect, scanPorts);
router.post('/ip', protect, analyzeIP);
router.post('/encrypt', protect, encryptText);
router.post('/web-scan', protect, scanWebsite);
router.post('/hash', protect, generateHash);
router.post('/base64', protect, base64Tool);
router.post('/binary', protect, binaryConverter);
router.post('/jwt-decode', protect, jwtDecoder);
router.post('/recon', protect, performRecon);
router.post('/dark-web', protect, darkWebScan);
router.post('/sandbox', protect, sandbox);
router.post('/metadata-strip', protect, stripMetadata);
router.post('/hash-decode', protect, decodeHash);
router.get('/history', protect, getToolHistory);

module.exports = router;
