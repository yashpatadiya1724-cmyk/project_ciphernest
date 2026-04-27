const { exec } = require('child_process')
const os = require('os')
const { Alert, ActivityLog } = require('../models/index')

// ── OUI Vendor Database ────────────────────────────────────────────
const OUI = {
  '00:50:F2': 'Microsoft', '00:1A:11': 'Google',
  'B8:27:EB': 'Raspberry Pi', 'DC:A6:32': 'Raspberry Pi',
  '00:17:F2': 'Apple', '00:1C:B3': 'Apple', '00:1E:52': 'Apple',
  '00:21:E9': 'Apple', '00:23:12': 'Apple', '00:25:00': 'Apple', '00:26:BB': 'Apple',
  '00:30:65': 'Cisco', '00:40:96': 'Cisco', '00:60:2F': 'Cisco',
  '58:97:BD': 'Cisco', 'E8:BA:70': 'Cisco', 'F8:72:EA': 'Cisco',
  '00:0C:E7': 'TP-Link', '50:C7:BF': 'TP-Link', '08:55:31': 'TP-Link',
  'A0:F3:C1': 'TP-Link', '54:AF:97': 'TP-Link', '2C:F0:5D': 'TP-Link',
  'B0:BE:76': 'TP-Link', 'EC:08:6B': 'TP-Link', 'C4:E9:84': 'TP-Link',
  '00:0F:66': 'Netgear', '00:14:6C': 'Netgear', '20:4E:7F': 'Netgear',
  '2C:B0:5D': 'Netgear', 'A0:40:A0': 'Netgear',
  '10:DA:43': 'Huawei', '20:08:ED': 'Huawei', '48:46:FB': 'Huawei',
  '68:A0:F6': 'Huawei', '40:4D:8E': 'Huawei',
  '00:1A:2B': 'Linksys', '00:20:ED': 'Linksys',
  '18:33:9D': 'D-Link', '1C:7E:E5': 'D-Link', '28:10:7B': 'D-Link', '14:D6:4D': 'D-Link',
  '00:1D:7E': 'Asus', '08:60:6E': 'Asus', 'AC:9E:17': 'Asus',
  '04:D4:C4': 'Asus', '50:46:5D': 'Asus', '2C:FD:A1': 'Asus', '3C:7C:3F': 'Asus',
  '40:B8:9A': 'Samsung', '78:52:1A': 'Samsung', '00:12:47': 'Samsung',
  '58:EF:68': 'Xiaomi', '74:51:BA': 'Xiaomi', '28:6C:07': 'Xiaomi', 'F4:8B:32': 'Xiaomi',
  'C0:56:27': 'Ubiquiti', '78:8A:20': 'Ubiquiti', 'DC:9F:DB': 'Ubiquiti', '80:2A:A8': 'Ubiquiti',
  'A4:2B:B0': 'Amazon', 'FC:65:DE': 'Amazon', '74:75:48': 'Amazon',
  '00:1F:33': 'Belkin', '94:44:52': 'Belkin', 'B4:75:0E': 'Belkin',
}

const getVendor = (bssid) => {
  if (!bssid || bssid.length < 8) return 'Unknown'
  const prefix8 = bssid.substring(0, 8).toUpperCase()
  const prefix5 = bssid.substring(0, 5).toUpperCase()
  return OUI[prefix8] || OUI[prefix5] || 'Unknown Vendor'
}

const isUnknownVendor = (vendor) => vendor === 'Unknown' || vendor === 'Unknown Vendor'

// ── OS-level WiFi scanning ─────────────────────────────────────────
const runCommand = (cmd, timeout = 15000) =>
  new Promise((resolve) => {
    exec(cmd, { timeout, encoding: 'utf8' }, (err, stdout, stderr) => {
      resolve({ stdout: stdout || '', stderr: stderr || '', err })
    })
  })

const parseWindows = (raw) => {
  const nets = []
  const ssidBlocks = raw.split(/^SSID\s+\d+\s*:\s*/im).slice(1)
  for (const block of ssidBlocks) {
    const lines = block.split('\n')
    const ssidName = (lines[0] || '').trim() || '<Hidden Network>'
    const authMatch = block.match(/Authentic\w*\s*[:=]\s*([^\r\n]+)/i)
    const encMatch = block.match(/Encryption\w*\s*[:=]\s*([^\r\n]+)/i)
    const auth = authMatch ? authMatch[1].trim() : 'Unknown'
    const enc = encMatch ? encMatch[1].trim() : 'Unknown'

    const bssidBlocks = block.split(/^\s*BSSID\s+\d+\s*:\s*/im).slice(1)
    for (const bb of bssidBlocks) {
      const macMatch = bb.match(/(([0-9a-fA-F]{2}[:\-]){5}[0-9a-fA-F]{2})/)
      if (!macMatch) continue
      const bssid = macMatch[1].toUpperCase()
      
      // Robust signal matching (handles "Signal : 88%2-Personal" etc.)
      const sigMatch = bb.match(/Signal\s*[:=]\s*(\d+)/i) || bb.match(/(\d+)\s*%/i)
      const sig = sigMatch ? Math.min(100, parseInt(sigMatch[1])) : 0
      
      const chMatch = bb.match(/(?:Channel|CH)\s*[:=]?\s*(\d+)/i)
      const ch = chMatch ? parseInt(chMatch[1]) : 0
      const bandMatch = bb.match(/(?:Band|Frequency)\s*[:=]\s*([^\r\n]+)/i)
      const bandRaw = bandMatch ? bandMatch[1].trim() : ''
      let freq = '2.4 GHz'
      if (bandRaw.includes('5') && !bandRaw.includes('2.4')) freq = '5 GHz'
      else if (bandRaw.includes('6')) freq = '6 GHz'
      else if (ch >= 36) freq = '5 GHz'
      const radioMatch = bb.match(/Radio\s*type\s*[:=]\s*([^\r\n]+)/i)
      const radio = radioMatch ? radioMatch[1].trim() : ''
      const vendor = getVendor(bssid)
      nets.push({
        ssid: ssidName, bssid, authentication: auth, encryption: enc,
        signal_pct: sig, signal_dbm: Math.round((sig / 2) - 100),
        channel: ch, frequency: freq, radio, bssid_count: bssidBlocks.length,
        vendor, vendor_unknown: isUnknownVendor(vendor)
      })
    }
  }
  return nets
}

const parseLinux = (raw) => {
  const nets = []
  for (const line of raw.trim().split('\n')) {
    const m = line.match(/^(.*?):((?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}):(\d+):(\d+):([\d.\s]*GHz)?:(.*?)$/)
    if (!m) continue
    const ssid = m[1] || '<Hidden Network>'
    const bssid = m[2].toUpperCase()
    const sig = parseInt(m[3]) || 0
    const ch = parseInt(m[4]) || 0
    const freqRaw = m[5] || ''
    const auth = m[6].trim() || 'Open'
    const freq = freqRaw.includes('5') ? '5 GHz' : '2.4 GHz'
    const vendor = getVendor(bssid)
    nets.push({
      ssid, bssid, authentication: auth, encryption: auth,
      signal_pct: sig, signal_dbm: Math.round((sig / 2) - 100),
      channel: ch, frequency: freq, radio: 'Unknown', bssid_count: 1,
      vendor, vendor_unknown: isUnknownVendor(vendor)
    })
  }
  return nets
}

const parseMac = (raw) => {
  const nets = []
  const lines = raw.trim().split('\n').slice(1)
  for (const line of lines) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 4) continue
    const ssid = parts[0]
    const bssid = parts[1].toUpperCase()
    const dbm = parseInt(parts[2]) || -90
    const ch = parseInt((parts[3] || '').split(',')[0]) || 0
    const auth = parts.slice(6).join(' ') || 'Open'
    const sig = Math.max(0, Math.min(100, (dbm + 100) * 2))
    const vendor = getVendor(bssid)
    nets.push({
      ssid, bssid, authentication: auth, encryption: auth,
      signal_pct: sig, signal_dbm: dbm,
      channel: ch, frequency: ch >= 36 ? '5 GHz' : '2.4 GHz',
      radio: 'Unknown', bssid_count: 1, vendor, vendor_unknown: isUnknownVendor(vendor)
    })
  }
  return nets
}

const scanWifi = async (attempt = 1) => {
  const platform = os.platform()
  try {
    let nets = []
    if (platform === 'win32') {
      const { stdout, stderr } = await runCommand('netsh wlan show networks mode=bssid')
      // Check for common Windows errors
      if (stdout.includes('interface is currently being utilized') || stdout.includes('not available')) {
        throw new Error('WiFi interface busy')
      }
      nets = parseWindows(stdout)
    } else if (platform === 'darwin') {
      const airport = '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport'
      const { stdout } = await runCommand(`${airport} -s`)
      nets = parseMac(stdout)
    } else {
      const { stdout, err } = await runCommand(
        'nmcli --escape no -t -f SSID,BSSID,SIGNAL,CHAN,FREQ,SECURITY dev wifi list'
      )
      if (!err && stdout.trim()) nets = parseLinux(stdout)
    }

    // Sticky / Retry logic: If we found nothing but it's a real scan, try one more time
    if (nets.length === 0 && attempt < 2 && platform !== 'darwin') {
      console.log(`[wifi] Scan returned 0 networks, retrying (attempt ${attempt + 1})...`)
      await new Promise(r => setTimeout(r, 1500)) // Wait 1.5s
      return scanWifi(attempt + 1)
    }

    // Final fallback to demo data only if it failed completely on a platform that should have it
    if (nets.length === 0 && platform !== 'win32' && platform !== 'darwin') {
      return getDemoNetworks()
    }
    
    return nets
  } catch (e) {
    if (attempt < 2) {
      console.log(`[wifi] Scan error: ${e.message}, retrying...`)
      await new Promise(r => setTimeout(r, 1500))
      return scanWifi(attempt + 1)
    }
    console.error('[wifi scan error]', e.message)
    return getDemoNetworks()
  }
}

// Demo data for environments without WiFi access (servers, CI, etc.)
const getDemoNetworks = () => [
  { ssid: 'HomeRouter_5G', bssid: 'AC:9E:17:A1:B2:C3', authentication: 'WPA3', encryption: 'CCMP', signal_pct: 82, signal_dbm: -59, channel: 36, frequency: '5 GHz', radio: '802.11ax', bssid_count: 2, vendor: 'Asus', vendor_unknown: false },
  { ssid: 'HomeRouter_2G', bssid: 'AC:9E:17:A1:B2:C4', authentication: 'WPA3', encryption: 'CCMP', signal_pct: 76, signal_dbm: -62, channel: 6, frequency: '2.4 GHz', radio: '802.11ax', bssid_count: 2, vendor: 'Asus', vendor_unknown: false },
  { ssid: 'CafeWiFi_Open', bssid: '00:00:00:AA:BB:CC', authentication: 'Open', encryption: 'None', signal_pct: 54, signal_dbm: -73, channel: 11, frequency: '2.4 GHz', radio: '802.11n', bssid_count: 1, vendor: 'Unknown Vendor', vendor_unknown: true },
  { ssid: 'OfficeNet', bssid: '50:C7:BF:11:22:33', authentication: 'WPA2', encryption: 'CCMP', signal_pct: 65, signal_dbm: -67, channel: 44, frequency: '5 GHz', radio: '802.11ac', bssid_count: 1, vendor: 'TP-Link', vendor_unknown: false },
  { ssid: 'NETGEAR_Legacy', bssid: '00:0F:66:55:44:33', authentication: 'WEP', encryption: 'WEP', signal_pct: 42, signal_dbm: -79, channel: 1, frequency: '2.4 GHz', radio: '802.11g', bssid_count: 1, vendor: 'Netgear', vendor_unknown: false },
  { ssid: 'FreePublicWiFi', bssid: 'DC:9F:DB:77:88:99', authentication: 'Open', encryption: 'None', signal_pct: 71, signal_dbm: -64, channel: 6, frequency: '2.4 GHz', radio: '802.11n', bssid_count: 1, vendor: 'Ubiquiti', vendor_unknown: false },
  { ssid: 'HomeRouter_5G', bssid: 'B8:27:EB:AA:BB:11', authentication: 'WPA2', encryption: 'CCMP', signal_pct: 68, signal_dbm: -66, channel: 36, frequency: '5 GHz', radio: '802.11ac', bssid_count: 1, vendor: 'Raspberry Pi', vendor_unknown: false },
  { ssid: 'NeighborNet', bssid: '40:B8:9A:CC:DD:EE', authentication: 'WPA2', encryption: 'CCMP', signal_pct: 28, signal_dbm: -86, channel: 9, frequency: '2.4 GHz', radio: '802.11n', bssid_count: 1, vendor: 'Samsung', vendor_unknown: false },
]

// ── Evil Twin Detection ────────────────────────────────────────────
const getBSSIDNumeric = (mac) => {
  if (!mac) return 0
  return parseInt(mac.replace(/[:\-]/g, ''), 16)
}

const detectEvilTwins = (nets) => {
  const ssidMap = {}
  for (const n of nets) {
    const key = n.ssid.toLowerCase()
    if (key && key !== '<hidden network>') {
      if (!ssidMap[key]) ssidMap[key] = []
      ssidMap[key].push(n)
    }
  }

  for (const n of nets) {
    const key = n.ssid.toLowerCase()
    const siblings = ssidMap[key] || []
    n.is_evil_twin_candidate = false
    n.ssid_ap_count = siblings.length
    
    if (siblings.length <= 1) continue

    const myBSSIDNum = getBSSIDNumeric(n.bssid)
    
    // 1. Check for clones on the SAME frequency band
    const sameBandSiblings = siblings.filter(s => s.bssid !== n.bssid && s.frequency === n.frequency)
    
    for (const sib of sameBandSiblings) {
      const sibBSSIDNum = getBSSIDNumeric(sib.bssid)
      const diff = Math.abs(myBSSIDNum - sibBSSIDNum)
      
      // If they are on the same band but have wildly different BSSIDs, flag suspicion
      // (Legit mesh nodes usually have consecutive or near-identical BSSIDs)
      if (diff > 512) { 
        if (n.vendor !== sib.vendor || n.vendor_unknown || sib.vendor_unknown) {
          n.is_evil_twin_candidate = true
          break
        }
      }
    }

    // 2. Check for vendor mismatch across any bands (very rare for legit dual-band setups)
    const vendors = new Set(siblings.map(s => s.vendor).filter(v => v !== 'Unknown Vendor'))
    if (vendors.size > 1) {
      n.is_evil_twin_candidate = true
    }
    
    // 3. Special case: If multiple APs on different bands have identical BSSIDs (rare but possible in some misconfigs)
    // Actually, we mostly want to REASSURE the user that 2.4/5GHz is safe
  }
  return nets
}

// ── Full Risk Analysis Engine ──────────────────────────────────────
const analyzeNetwork = (network) => {
  const { authentication: auth = '', encryption: enc = '', signal_pct: sig = 0,
    signal_dbm: dbm = -100, channel: ch = 0, vendor = 'Unknown', bssid = '',
    bssid_count = 1, ssid_ap_count = 1, is_evil_twin_candidate: evil = false,
    vendor_unknown: unkV = false, ssid = '', frequency: freq = '', radio = '' } = network

  let score = 0
  const threats = [], indicators = [], recommendations = []

  // 1. Encryption quality
  if (!auth || ['Open', '', 'Unknown', 'None'].includes(auth)) {
    score += 75
    threats.push('No encryption — all traffic visible to anyone nearby')
    indicators.push('Authentication: Open — zero password protection')
    recommendations.push('Do NOT connect — use mobile data instead')
    recommendations.push('Never do banking or login on open networks')
  } else if (auth.includes('WEP') || enc.includes('WEP')) {
    score += 65
    threats.push('WEP encryption is mathematically broken — crackable in under 60 seconds')
    indicators.push(`WEP cipher on BSSID ${bssid.slice(0, 14)} — obsolete since 2001`)
    recommendations.push('Avoid completely — WEP offers no real security')
    recommendations.push('Ask the owner to upgrade to WPA2 or WPA3')
  } else if (auth.includes('WPA') && !auth.includes('WPA2') && !auth.includes('WPA3')) {
    score += 28
    threats.push('Original WPA-TKIP has known cryptographic weaknesses')
    indicators.push('WPA-TKIP protocol — vulnerable to certain replay attacks')
    recommendations.push('Prefer WPA2/WPA3 networks when available')
  } else if (auth.includes('WPA2') && !auth.includes('WPA3')) {
    score += 5
    indicators.push(`WPA2-Personal with ${enc} cipher — current industry standard`)
  } else if (auth.includes('WPA3')) {
    indicators.push('WPA3-SAE encryption — latest generation, highly secure')
    recommendations.push('Excellent security — WPA3 resists brute-force attacks')
  }

  // 2. Signal strength
  if (sig >= 95) {
    score += 6
    indicators.push(`Extremely strong signal (${sig}%, ${dbm}dBm) — device may be very close or boosted`)
    if (unkV) threats.push('High signal from unknown vendor — possible proximity attack')
  } else if (sig >= 80) {
    indicators.push(`Strong signal: ${sig}% (${dbm}dBm) — router nearby`)
  } else if (sig >= 50) {
    indicators.push(`Moderate signal: ${sig}% (${dbm}dBm) — normal range`)
  } else if (sig >= 25) {
    score += 2
    indicators.push(`Weak signal: ${sig}% (${dbm}dBm) — router is far away`)
    recommendations.push('Weak signal causes frequent disconnections — move closer')
  } else {
    score += 4
    indicators.push(`Very weak signal: ${sig}% (${dbm}dBm) — barely in range`)
  }

  // 3. Channel analysis
  if (freq.includes('2.4')) {
    if ([6, 11].includes(ch)) {
      score += 3
      indicators.push(`Channel ${ch} (2.4GHz) — most congested channel, expect interference`)
    } else if (ch > 0) {
      score += 1
      indicators.push(`Channel ${ch} (2.4GHz) — moderately used channel`)
    }
  } else if (freq.includes('5')) {
    score = Math.max(0, score - 2)
    indicators.push(`Channel ${ch} (5GHz) — less congested, faster and more secure`)
  } else if (freq.includes('6')) {
    score = Math.max(0, score - 3)
    indicators.push(`Channel ${ch} (6GHz/Wi-Fi 6E) — latest band, minimal interference`)
  }

  // 4. Evil Twin detection
  if (evil) {
    score += 28
    threats.push(`Multiple APs (${ssid_ap_count}) share '${ssid}' on same frequency — Evil Twin pattern`)
    indicators.push(`BSSID ${bssid.slice(0, 14)} is one of ${ssid_ap_count} APs with identical SSID+band`)
    recommendations.push('Check your known router BSSID against this one')
    recommendations.push('Do not connect if this BSSID is unfamiliar')
  } else if (ssid_ap_count > 1) {
    indicators.push(`Dual-band router: ${ssid_ap_count} APs on different bands — normal behavior`)
  }

  // 5. Vendor check
  if (unkV) {
    score += 10
    indicators.push(`MAC prefix ${bssid.slice(0, 8)} not in vendor database — manufacturer unknown`)
    threats.push(`Unrecognised hardware vendor for ${ssid} — verify the physical router`)
    recommendations.push('Physically check the router matches the network name')
  } else {
    indicators.push(`Router manufacturer: ${vendor} — verified in OUI database`)
  }

  // 6. SSID name patterns
  const ssidLower = ssid.toLowerCase()
  const suspiciousKw = ['free', 'public', 'open', 'guest', 'hack', 'test', 'default', 'linksys', 'netgear', 'dlink', 'tp-link']
  const suspMatch = suspiciousKw.find(k => ssidLower.includes(k))
  if (suspMatch) {
    score += 5
    indicators.push(`SSID contains '${suspMatch}' — common rogue hotspot naming pattern`)
    threats.push(`Network name '${ssid}' matches patterns used in fake hotspot attacks`)
  }
  if (!ssid || ssid === '<Hidden Network>') {
    score += 8
    indicators.push('Hidden SSID — network not publicly broadcasting its name')
    threats.push('Hidden networks can probe-target devices that auto-connect to known SSIDs')
  }

  // 7. Radio/protocol generation
  if (radio.includes('802.11ax') || radio.includes('Wi-Fi 6')) {
    score = Math.max(0, score - 3)
    indicators.push('Wi-Fi 6 (802.11ax) — latest generation hardware, strong security')
  } else if (radio.includes('802.11ac')) {
    score = Math.max(0, score - 1)
    indicators.push('Wi-Fi 5 (802.11ac) — modern hardware')
  } else if (radio.includes('802.11n')) {
    indicators.push('Wi-Fi 4 (802.11n) — older but still common')
  } else if (radio.includes('802.11g') || radio.includes('802.11b')) {
    score += 3
    indicators.push('Wi-Fi 3/2 (802.11g/b) — very old hardware, consider upgrading')
  }

  score = Math.max(0, Math.min(score, 100))

  const riskLevel = score >= 70 ? 'HIGH' : score >= 36 ? 'MEDIUM' : 'LOW'
  const sigNote = sig >= 75 ? 'strong' : sig >= 45 ? 'moderate' : 'weak'
  const proto = auth.includes('WPA3') ? 'WPA3' : auth.includes('WPA2') ? 'WPA2' : auth.includes('WPA') ? 'WPA' : 'open'
  const bandNote = freq || 'unknown band'

  // Unique verdict per network
  let verdict, threatSummary, whyRisky
  if (riskLevel === 'HIGH') {
    if (evil) verdict = `'${ssid}' has ${ssid_ap_count} APs on the same band — classic Evil Twin attack pattern. Do not connect.`
    else if (!auth || ['Open', ''].includes(auth)) verdict = `'${ssid}' has no password on ${bandNote} CH${ch} — all traffic visible to anyone nearby.`
    else if (auth.includes('WEP')) verdict = `'${ssid}' uses WEP encryption (${bssid.slice(0, 14)}) — crackable in under 60 seconds with free tools.`
    else verdict = `'${ssid}' scored ${score}/100 due to multiple risk factors — avoid connecting.`
    threatSummary = `WifiGuard flagged '${ssid}' (BSSID ${bssid.slice(0, 14)}) as HIGH RISK (${score}/100). ${evil ? `Evil Twin: ${ssid_ap_count} APs share this SSID on the same frequency — a hacker may be mimicking your router. ` : ''}${!auth || auth === 'Open' ? `The network is completely open on ${bandNote} channel ${ch} — zero encryption. ` : ''}${auth.includes('WEP') ? 'WEP encryption detected — this cipher has been broken since 2001. ' : ''}Signal is ${sig}% (${dbm}dBm) from an ${unkV ? 'unverified' : 'identified'} ${vendor} router.`
    whyRisky = `'${ssid}' scores ${score}/100. ${evil ? `${ssid_ap_count} APs with identical SSID and frequency suggest a rogue access point has been planted nearby. ` : ''}${!auth || auth === 'Open' ? 'No password means every packet you send — passwords, messages, browsing — is readable by anyone nearby. ' : ''}${auth.includes('WEP') ? 'WEP was mathematically broken in 2001; any attacker can crack it in under a minute. ' : ''}The ${unkV ? 'unrecognised ' : ''}${vendor} hardware at ${bssid.slice(0, 14)} broadcasts at ${sig}% signal on CH${ch}.`
  } else if (riskLevel === 'MEDIUM') {
    const vendorTxt = unkV ? `unrecognised vendor (MAC ${bssid.slice(0, 8)})` : `${vendor} router`
    verdict = `'${ssid}' has a ${vendorTxt} on channel ${ch} in the ${bandNote} with ${sigNote} signal (${sig}%) — some concerns noted.`
    threatSummary = `WifiGuard assigned MEDIUM risk (${score}/100) to '${ssid}' at BSSID ${bssid.slice(0, 14)}. ${unkV ? 'The hardware vendor is not in our database — minor red flag. ' : `Hardware identified as ${vendor}. `}Signal is ${sig}% (${dbm}dBm) on ${bandNote} channel ${ch}. ${auth.includes('WPA') && !auth.includes('WPA2') ? 'Original WPA-TKIP has known weaknesses. ' : ''}No immediate danger but avoid banking or sensitive logins.`
    whyRisky = `Score: ${score}/100. '${ssid}' uses ${proto} on ${bandNote} CH${ch} with ${sig}% (${dbm}dBm) signal. ${unkV ? `The ${vendorTxt} could not be confirmed in vendor databases. ` : `${vendor} hardware confirmed. `}${auth.includes('WPA') && !auth.includes('WPA2') ? 'WPA-TKIP has known replay attack vulnerabilities. ' : ''}Avoid entering passwords or doing banking on this network.`
  } else {
    const encLabel = auth.includes('WPA3') ? 'WPA3 (latest generation)' : auth.includes('WPA2') ? 'WPA2-Personal' : auth
    verdict = `'${ssid}' on ${bandNote} CH${ch} uses ${encLabel} — risk score ${score}/100, no active threats.`
    threatSummary = `WifiGuard scanned '${ssid}' (BSSID ${bssid.slice(0, 14)}) and assigned LOW risk (${score}/100). Signal is ${sig >= 75 ? 'excellent' : sig >= 45 ? 'moderate' : 'low'} (${sig}%) on ${bandNote} CH${ch}. Encryption: ${encLabel}. ${unkV ? 'Vendor unrecognised — minor concern but not critical for a password-protected network. ' : `Router identified as ${vendor} — verified. `}No Evil Twin patterns, open access points, or obvious attack signatures detected.`
    whyRisky = `'${ssid}' scores ${score}/100. It broadcasts on ${bandNote} CH${ch} with ${sig}% (${dbm}dBm) signal. The ${unkV ? `unverified hardware (MAC ${bssid.slice(0, 8)})` : vendor} uses ${encLabel} encryption${auth.includes('WPA3') ? ' — virtually uncrackable.' : auth.includes('WPA2') ? ' — the current industry standard.' : '.'}${ssid_ap_count > 1 ? ` One of ${ssid_ap_count} APs detected — consistent with a dual-band router.` : ''} Always use HTTPS and avoid sharing passwords on networks you don't own.`
  }

  if (!recommendations.length) {
    recommendations.push(`Use HTTPS-only websites when connected to ${ssid}`)
    recommendations.push('Enable 2-factor authentication on important accounts')
    recommendations.push('Consider a VPN for an extra layer of protection')
  }
  if (!threats.length) threats.push(`No significant threats detected for ${ssid}`)

  return {
    riskLevel, riskScore: score, verdict, isEvilTwin: evil, isSpoofed: false,
    threatSummary, whyRisky,
    technicalIndicators: indicators.slice(0, 5),
    threats: threats.slice(0, 4),
    recommendations: recommendations.slice(0, 4),
    analyzedBy: 'CipherNest Risk Engine v2'
  }
}

// ── API Handler ────────────────────────────────────────────────────
const getWifiNetworks = async (req, res) => {
  try {
    let nets = await scanWifi()
    nets = detectEvilTwins(nets)

    const openCount = nets.filter(n => !n.authentication || ['Open', '', 'Unknown'].includes(n.authentication)).length
    const wepCount = nets.filter(n => (n.authentication || '').includes('WEP')).length
    const evilCount = nets.filter(n => n.is_evil_twin_candidate).length
    const globalStatus = (openCount > 0 || evilCount > 0) ? 'THREAT'
      : wepCount > 0 ? 'CAUTION'
      : nets.length ? 'SAFE' : 'UNKNOWN'

    // Analyze each network and attach result
    const analyzed = nets.map(n => ({ ...n, analysis: analyzeNetwork(n) }))
    const highRisk = analyzed.filter(n => n.analysis.riskLevel === 'HIGH')

    // Create alerts for high risk networks
    for (const net of highRisk) {
      await Alert.findOneAndUpdate(
        { userId: req.user._id, source: 'wifi', title: `Unsafe WiFi: ${net.ssid}` },
        {
          userId: req.user._id, type: 'critical',
          title: `Unsafe WiFi: ${net.ssid}`,
          message: net.analysis.threatSummary,
          source: 'wifi'
        },
        { upsert: true, new: true }
      )
    }

    await ActivityLog.create({
      userId: req.user._id, action: 'WiFi Guard scan',
      details: `Found ${nets.length} networks — ${openCount} open, ${wepCount} WEP, ${evilCount} evil twin suspect(s)`,
      icon: '📡'
    })

    res.json({
      networks: analyzed,
      globalStatus,
      stats: { total: nets.length, open: openCount, wep: wepCount, evil: evilCount, secure: nets.length - openCount - wepCount },
      scannedAt: new Date(),
      platform: os.platform()
    })
  } catch (error) {
    console.error('[wifi error]', error)
    res.status(500).json({ message: 'WiFi scan failed', error: error.message })
  }
}

// Analyze a single network (called from frontend for on-demand analysis)
const analyzeNetworkEndpoint = async (req, res) => {
  try {
    const { network } = req.body
    if (!network) return res.status(400).json({ message: 'Network data required' })
    const result = analyzeNetwork(network)
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: 'Analysis failed', error: error.message })
  }
}

module.exports = { getWifiNetworks, analyzeNetworkEndpoint }
