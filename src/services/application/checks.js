/* eslint-disable no-unused-vars */
const axios = require('axios');
const config = require('config');
const https = require('https');
const ethers = require('ethers');
const serviceHelper = require('../serviceHelper');
const log = require('../../lib/log');

const timeout = 3456;
const generalWebsiteApps = ['website', 'AtlasCloudMainnet', 'HavenVaultMainnet', 'KDLaunch', 'paoverview', 'FluxInfo', 'Jetpack2', 'jetpack', 'web', 'eckodexswap', 'eckodexvault'];
const ethersList = [
  {
    name: 'BitgertRPC', providerURL: null, cmd: 'eth_syncing', port: '32300',
  },
  {
    name: 'CeloRPC', providerURL: 'https://forno.celo.org', cmd: 'eth_syncing', port: '35000',
  },
  {
    name: 'WanchainRpc', providerURL: null, cmd: 'eth_syncing', port: '31000',
  },
  {
    name: 'FuseRPC', providerURL: 'https://fuse-mainnet.chainstacklabs.com', cmd: 'eth_syncing', port: '38545',
  },
  {
    name: 'AstarRPC', providerURL: null, cmd: 'system_health', port: '36011',
  },
];
let currentFluxBlockheight = 1379811;
// MAIN
async function checkLoginPhrase(ip, port) {
  try {
    const url = `http://${ip}:${port}/id/loginphrase`;
    const response = await serviceHelper.httpGetRequest(url, timeout);
    if (response.data.status === 'success') {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function isCommunicationOK(ip, port) {
  try {
    const urlA = `http://${ip}:${port}/flux/connectedpeersinfo`;
    const urlB = `http://${ip}:${port}/flux/incomingconnectionsinfo`;
    const responseA = await serviceHelper.httpGetRequest(urlA, timeout);
    if (responseA.data.data.length > 8) {
      const responseB = await serviceHelper.httpGetRequest(urlB, timeout);
      if (responseB.data.data.length > 4) {
        return true;
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function isHomeOK(ip, port) {
  try {
    const url = `http://${ip}:${port}`;
    const response = await serviceHelper.httpGetRequest(url, timeout);
    if (response.data.startsWith('<!DOCTYPE html><html')) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function isVersionOK(ip, port) {
  try {
    const url = `http://${ip}:${port}/flux/info`;
    const response = await serviceHelper.httpGetRequest(url, timeout);
    const version = response.data.data.flux.version.replace(/\./g, '');
    if (+version >= 440 && version[0] >= 4) {
      if (response.data.data.flux.development === 'false' || !response.data.data.flux.development) {
        return true;
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function isSyncedOK(ip, port) {
  try {
    const url = `http://${ip}:${port}/explorer/scannedheight`;
    const response = await serviceHelper.httpGetRequest(url, timeout);
    const height = response.data.data.generalScannedHeight;
    if (height >= currentFluxBlockheight) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function hasManyApps(ip, port) {
  try {
    const url = `http://${ip}:${port}/apps/globalappsspecifications`;
    const response = await serviceHelper.httpGetRequest(url, timeout);
    const appsAmount = response.data.data.length;
    if (appsAmount > 1000) { // we surely have at least 1000 apps on network
      // eslint-disable-next-line no-restricted-syntax
      for (const app of config.mandatoryApps) {
        const appExists = response.data.data.find((a) => a.name === app);
        if (!appExists) {
          return false;
        }
      }
    }
    return true;
  } catch (error) {
    return false;
  }
}

async function hasManyMessages(ip, port) {
  try {
    const url = `http://${ip}:${port}/apps/hashes`;
    const response = await serviceHelper.httpGetRequest(url, timeout);
    const appsAmount = response.data.data.length;
    if (appsAmount > 23500) {
      const messageFalse = response.data.data.filter((a) => a.message === false);
      if (messageFalse.length < 100) {
        return true;
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function checkMainFlux(ip, port = 16127) {
  try {
    const versionOK = await isVersionOK(ip, port);
    if (versionOK) {
      // eslint-disable-next-line no-await-in-loop
      const loginPhraseOK = await checkLoginPhrase(ip, port);
      if (loginPhraseOK) {
        // eslint-disable-next-line no-await-in-loop
        const communicationOK = await isCommunicationOK(ip, port);
        if (communicationOK) {
          const isSynced = await isSyncedOK(ip, port);
          if (isSynced) {
            const hasApps = await hasManyApps(ip, port);
            if (hasApps) {
              const hasMessages = await hasManyMessages(ip, port);
              if (hasMessages) {
                // eslint-disable-next-line no-await-in-loop
                const uiOK = await isHomeOK(ip, +port - 1);
                if (uiOK) {
                  return true;
                }
              }
            }
          }
        }
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

// KUSAMA
function checkheightOKksm(height) {
  const currentTime = new Date().getTime();
  const baseTime = 1622640282000;
  const baseHeight = 7739485;
  const timeDifference = currentTime - baseTime;
  const blocksPassedInDifference = (timeDifference / 6000); // 6 secs
  const currentBlockEstimation = baseHeight + blocksPassedInDifference;
  const minimumAcceptedBlockHeight = currentBlockEstimation - 600; // allow being off sync for 600 blocks; 1 hour
  console.log(minimumAcceptedBlockHeight);
  if (height > minimumAcceptedBlockHeight) {
    return true;
  }
  return false;
}

function checkheightOKdot(height) {
  const currentTime = new Date().getTime();
  const baseTime = 1622640408000;
  const baseHeight = 5331005;
  const timeDifference = currentTime - baseTime;
  const blocksPassedInDifference = (timeDifference / 6000); // 6 secs
  const currentBlockEstimation = baseHeight + blocksPassedInDifference;
  const minimumAcceptedBlockHeight = currentBlockEstimation - 600; // allow being off sync for 600 blocks; 1 hour
  console.log(minimumAcceptedBlockHeight);
  if (height > minimumAcceptedBlockHeight) {
    return true;
  }
  return false;
}

// POLKADOT

async function getPolkaNetworkHeight(ip, port) {
  try {
    const max = 1000000;
    const min = 1;

    const data = {
      jsonrpc: '2.0',
      method: 'system_syncState',
      params: [],
      id: Math.floor(Math.random() * (max - min + 1)) + min,
    };
    const headers = {
      'Content-Type': 'application/json',
    };
    const rosettaData = await serviceHelper.httpPostRequest(`http://${ip}:${port}/network/status`, data, 3456, headers);
    console.log(rosettaData.data.result);
    return rosettaData.data.result.currentBlock;
  } catch (e) {
    // log.error(e);
    return -1;
  }
}

// ROSETTA
async function checkRosettaSynced(ip, height) {
  try {
    const agent = new https.Agent({
      rejectUnauthorized: false,
    });
    const data = {
      network_identifier: {
        blockchain: 'flux',
        network: 'mainnet',
      },
      block_identifier: {
        index: height - 30,
      },
    };
    const rosettaData = await serviceHelper.httpPostRequest(`http://${ip}:38080/network/status`, data, 3456, undefined, agent);
    return rosettaData.data.block.block_identifier.index;
  } catch (e) {
    // log.error(e);
    return false;
  }
}

async function getRosettaHeight(ip) {
  try {
    const agent = new https.Agent({
      rejectUnauthorized: false,
    });
    const data = {
      network_identifier: {
        blockchain: 'flux',
        network: 'mainnet',
      },
    };
    const rosettaData = await serviceHelper.httpPostRequest(`http://${ip}:38080/network/status`, data, 3456, undefined, agent);
    return rosettaData.data.current_block_identifier.index;
  } catch (e) {
    // log.error(e);
    return -1;
  }
}

function checkRosettaheightOK(height) {
  const currentTime = new Date().getTime();
  const baseTime = 1623245290000;
  const baseHeight = 878090;
  const timeDifference = currentTime - baseTime;
  const blocksPassedInDifference = (timeDifference / 120000); // 120 secs
  const currentBlockEstimation = baseHeight + blocksPassedInDifference;
  const minimumAcceptedBlockHeight = currentBlockEstimation - 720; // allow being off sync for 720 blocks; 1 day
  if (height > minimumAcceptedBlockHeight) {
    return true;
  }
  return false;
}

// KADENA
function kadenaCheckHeight(height) {
  const currentTime = new Date().getTime();
  const baseTime = 1625422726000;
  const baseHeight = 35347955;
  const timeDifference = currentTime - baseTime;
  const blocksPassedInDifference = (timeDifference / 30000) * 20; // 20 chains with blocktime 30 seconds
  const currentBlockEstimation = baseHeight + blocksPassedInDifference;
  const minimumAcceptedBlockHeight = currentBlockEstimation - (60 * 310); // allow being off sync for 1200 blocks; 30 mins
  if (height > minimumAcceptedBlockHeight) {
    return true;
  }
  return false;
}

function kadenaCheckPeers(peers) {
  try {
    const goodPeers = peers.filter((peer) => peer.address.hostname.includes('chainweb')); // has outside of flux too
    if (goodPeers.length > 1) { // at least 2 chainweb peers
      return true;
    }
    const goodPeersPort = peers.filter((peer) => peer.address.port !== 31350); // has outside of flux too
    if (goodPeersPort.length > 4) { // at least 5 different than flux peers
      return true;
    }
    return false;
  } catch (error) {
    log.error(error);
    return true;
  }
}

async function kadenaGetHeight(ip) {
  try {
    const agent = new https.Agent({
      rejectUnauthorized: false,
    });
    const { CancelToken } = axios;
    const source = CancelToken.source();
    let isResolved = false;
    setTimeout(() => {
      if (!isResolved) {
        source.cancel('Operation canceled by the user.');
      }
    }, timeout * 2);
    const kadenaData = await axios.get(`https://${ip}:31350/chainweb/0.0/mainnet01/cut`, { httpsAgent: agent, timeout, cancelToken: source.token });
    isResolved = true;
    return kadenaData.data.height;
  } catch (e) {
    // log.error(e);
    return -1;
  }
}

async function kadenaGetConenctions(ip) {
  try {
    const agent = new https.Agent({
      rejectUnauthorized: false,
    });
    const { CancelToken } = axios;
    const source = CancelToken.source();
    let isResolved = false;
    setTimeout(() => {
      if (!isResolved) {
        source.cancel('Operation canceled by the user.');
      }
    }, timeout * 2);
    const kadenaData = await axios.get(`https://${ip}:31350/chainweb/0.0/mainnet01/cut/peer`, { httpsAgent: agent, timeout, cancelToken: source.token });
    isResolved = true;
    return kadenaData.data.items;
  } catch (e) {
    // log.error(e);
    return [];
  }
}

async function checkKadenaApplication(ip) {
  try {
    const height = await kadenaGetHeight(ip);
    if (kadenaCheckHeight(height)) {
      // eslint-disable-next-line no-await-in-loop
      const peers = await kadenaGetConenctions(ip);
      if (kadenaCheckPeers(peers)) {
        return true;
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function checkRunOnFluxWebsite(ip, port) {
  try {
    const websiteResponse = await serviceHelper.httpGetRequest(`http://${ip}:${port}`, 8888);
    if (websiteResponse.data.includes('<title>Flux')) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function checkMOKWebsite(ip, port) {
  try {
    const websiteResponse = await serviceHelper.httpGetRequest(`http://${ip}:${port}`, 5000);
    if (websiteResponse.data.includes('<title>The Miners')) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function checkCloudAtlasWebsite(ip, port) {
  try {
    const websiteResponse = await serviceHelper.httpGetRequest(`http://${ip}:${port}`, 8888);
    if (websiteResponse.data.includes('<title>Atlas')) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function checkFluxExplorer(ip, port) {
  try {
    const response = await serviceHelper.httpGetRequest(`http://${ip}:${port}/api/addr/t3c51GjrkUg7pUiS8bzNdTnW2hD25egWUih`, 8888);
    const responseB = await serviceHelper.httpGetRequest(`http://${ip}:${port}/api/sync`, 8888);
    // eslint-disable-next-line no-use-before-define
    if (response.data.transactions.length > 0 && responseB.data.blockChainHeight >= currentFluxBlockheight) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function checkHavenHeight(ip, port) {
  try {
    const response = await serviceHelper.httpGetRequest(`http://${ip}:${port}/get_info`, 5000);
    if (response.data.height > response.data.target_height && response.data.height > 1) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function checkKDLaunch(ip, port) {
  try {
    const websiteResponse = await serviceHelper.httpGetRequest(`http://${ip}:${port}`, 2000);
    if (websiteResponse.data.includes('<title>KDLaunch')) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function checkHavenValut(ip, port) {
  try {
    const websiteResponse = await serviceHelper.httpGetRequest(`http://${ip}:${port}`, 2000);
    if (websiteResponse.data.includes('<title>Haven')) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function generalWebsiteCheck(ip, port, timeOut = 2500, appname) {
  try {
    const websiteResponse = await serviceHelper.httpGetRequest(`http://${ip}:${port}`, timeOut);
    if (appname.startsWith('themok')) {
      log.error(websiteResponse);
    }
    if (websiteResponse.data.includes('<html')) {
      return true;
    }
    log.error(websiteResponse.data);
    return false;
  } catch (error) {
    log.error(error);
    if (appname.startsWith('themok')) {
      log.error(error);
    }
    return false;
  }
}

async function checkBlockBook(ip, port, appsname) {
  try {
    const coinList = ['litecoin', 'flux', 'ethereumclassic', 'vertcoin', 'zcash', 'dogecoin', 'digibyte', 'groestlcoin', 'dash', 'firo', 'sin', 'ravencoin', 'pivx', 'decred', 'neurai'];
    const addressList = ['LVjoCYFESyTbKAEU5VbFYtb9EYyBXx55V5', 't1UPSwfMYLe18ezbCqnR5QgdJGznzCUYHkj', '0x0e009d19cb4693fcf2d15aaf4a5ee1c8a0bb5ecf', 'VbFrQgNEiR8ZxMh9WmkjJu9kkqjJA6imdD',
      't1UPSwfMYLe18ezbCqnR5QgdJGznzCUYHkj', 'DFewUat3fj7pbMiudwbWpdgyuULCiVf6q8', 'DFewUat3fj7pbMiudwbWpdgyuULCiVf6q8', 'FfgZPEfmvou5VxZRnTbRjPKhgVsrx7Qjq9',
      'XmCgmabJL2S8DJ8tmEvB8QDArgBbSSMJea', 'aBEJgEP2b7DP7tyQukv639qtdhjFhWp2QE', 'SXoqyAiZ6gQjafKmSnb2pmfwg7qLC8r4Sf', 'RKo31qpgy9278MuWNXb5NPranc4W6oaUFf',
      'DTVg3KVrPiv9QLPT1cYQ8XYV6SUugMYkZV', 'DsUbTWsJWNzNdfUigTrUqbxmnwntDBJXasi', 'NfXjy71SH9CdC8tNzQjkYGKUCYfMsTPaKS'];
    let coin = appsname.replace('blockbook', '');
    coin = coin.replace(/\d+/g, '');
    const index = coinList.indexOf(coin);
    const response1 = await serviceHelper.httpGetRequest(`http://${ip}:${port}/api`, 5000);
    const response2 = await serviceHelper.httpGetRequest(`http://${ip}:${port}/api/v2/address/${addressList[index]}?pageSize=50`, 5000);
    if (response2.data.txids.length > 0 && response1.data.blockbook.inSync === true && response1.data.blockbook.bestHeight > (response1.data.backend.blocks - 100) && response1.data.blockbook.bestHeight > 0 && response1.data.backend.blocks > 0) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function checkAlgorand(ip, port) {
  const axiosConfig = {
    timeout: 13456,
  };
  try {
    const status = await axios.get(`http://${ip}:${port}/health`, axiosConfig);
    // eslint-disable-next-line no-restricted-syntax
    if (status.data.isSynced === true) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

async function checkEthers(ip, port, providerURL, cmd) {
  try {
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(resolve, 10000, true);
    });
    const node = `http://${ip}:${port}`;
    const provider = new ethers.providers.JsonRpcProvider(node);
    const syncingPromise = provider.send(cmd);
    const isSyncing = await Promise.race([syncingPromise, timeoutPromise]);
    if (isSyncing) {
      if (isSyncing.isSyncing === true || isSyncing.isSyncing === null || isSyncing.isSyncing === undefined) {
        return false;
      }
    }
    if (providerURL) {
      const blockNum = await provider.getBlockNumber();
      const providerB = new ethers.providers.JsonRpcProvider(providerURL);
      const blockNumB = await providerB.getBlockNumber();
      if (blockNumB - blockNum > 1) {
        return false;
      }
    }
    return true;
  } catch (error) {
    return false;
  }
}

async function checkApplication(app, ip) {
  let isOK = true;
  if (generalWebsiteApps.includes(app.name)) {
    isOK = await generalWebsiteCheck(ip.split(':')[0], app.port || app.ports ? app.ports[0] : app.compose[0].ports[0], undefined, app.name);
  } else if (app.name === 'explorer') {
    isOK = await checkFluxExplorer(ip.split(':')[0], 39185);
  } else if (app.name === 'HavenNodeMainnet') {
    isOK = await checkHavenHeight(ip.split(':')[0], 31750);
  } else if (app.name === 'HavenNodeTestnet') {
    isOK = await checkHavenHeight(ip.split(':')[0], 32750);
  } else if (app.name === 'HavenNodeStagenet') {
    isOK = await checkHavenHeight(ip.split(':')[0], 33750);
  } else if (app.name.startsWith('blockbook')) {
    isOK = await checkBlockBook(ip.split(':')[0], app.compose[0].ports[0], app.name);
  } else if (app.name.startsWith('AlgorandRPC')) {
    isOK = await checkAlgorand(ip.split(':')[0], app.compose[0].ports[1]);
  } else {
    const matchIndex = ethersList.findIndex((eApp) => app.name.startsWith(eApp.name));
    if (matchIndex > -1) {
      isOK = await checkEthers(ip.split(':')[0], ethersList[matchIndex].port, ethersList[matchIndex].providerURL, ethersList[matchIndex].cmd);
    }
  }
  return isOK;
}

setInterval(async () => {
  try {
    const response = await axios.get('https://explorer.runonflux.io/api/status');
    const height = response.data.info.blocks;
    if (height > currentFluxBlockheight) {
      currentFluxBlockheight = height;
    }
  } catch (error) {
    log.error(error);
    log.error('ERROR OBTAINING FLUX HEIGHT');
  }
}, 120 * 1000);

module.exports = {
  checkMainFlux,
  checkKadenaApplication,
  checkRunOnFluxWebsite,
  checkFluxExplorer,
  checkCloudAtlasWebsite,
  checkHavenHeight,
  checkKDLaunch,
  checkMOKWebsite,
  checkHavenValut,
  generalWebsiteCheck,
  checkApplication,
  checkBlockBook,
  checkAlgorand,
  checkEthers,
};
