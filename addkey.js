'use strict';

var hfc = require('fabric-client'); 
var path = require('path'); 
var util = require('util'); 
var sdkUtils = require('fabric-client/lib/utils') 
const fs = require('fs'); 
var options = { 
    user_id: 'Admin@org1.example.com', 
    msp_id:'Org1MSP', 
    channel_id: 'mychannel', 
    chaincode_id: 'mycc', 
    peer0_org1_url: 'grpcs://192.168.2.177:7051',//因为启用了TLS，所以是grpcs,如果没有启用TLS，那么就是grpc
	peer0_org2_url: 'grpcs://192.168.2.177:9051',//因为启用了TLS，所以是grpcs,如果没有启用TLS，那么就是grpc
    event_url: 'grpcs://192.168.2.177:7053',//因为启用了TLS，所以是grpcs,如果没有启用TLS，那么就是grpc 
    orderer_url: 'grpcs://192.168.2.177:7050',//因为启用了TLS，所以是grpcs,如果没有启用TLS，那么就是grpc 
    privateKeyFolder:'./crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore', //Admin的私钥
    signedCert:'./crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/Admin@org1.example.com-cert.pem', //Admin的公钥
    peer0_org1_tls_cacerts:'./crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt', //peer0.org1的tls证书
	peer0_org2_tls_cacerts:'./crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt', //peer0.org2的tls证书
    orderer_tls_cacerts:'./crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt', //oderer的tls证书
    server_hostname: "peer0.org1.example.com",
	server1_hostname: "peer0.org2.example.com" 
};

//peer chaincode invoke -o orderer.example.com:7050 --tls true 
//--cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem 
//-C $CHANNEL_NAME -n mycc 
//--peerAddresses peer0.org1.example.com:7051 --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt 
//--peerAddresses peer0.org2.example.com:7051 --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt 
//-c '{"Args":["invoke","a","b","10"]}'

var channel = {}; 
var client = null; 
var targets = []; 
var tx_id = null;

const getKeyFilesInDir = (dir) => { 
		//该函数用于找到keystore目录下的私钥文件的路径 
        const files = fs.readdirSync(dir) 
        const keyFiles = [] 
        files.forEach((file_name) => { 
                let filePath = path.join(dir, file_name) 
                if (file_name.endsWith('_sk')) { 
                        keyFiles.push(filePath) 
                } 
        }) 
        return keyFiles 
} 
Promise.resolve().then(() => { 
    console.log("Load privateKey and signedCert"); 
    client = new hfc(); 
    var    createUserOpt = { 
                username: options.user_id, 
                mspid: options.msp_id, 
                cryptoContent: { privateKey: getKeyFilesInDir(options.privateKeyFolder)[0], 
					signedCert: options.signedCert 
				} 
         } 
		 
//以上代码指定了当前用户的私钥，证书等基本信息 
return sdkUtils.newKeyValueStore({ 
                        path: "./tmp/fabric-client-stateStore/" 
                }).then((store) => { 
                        client.setStateStore(store) 
                        return client.createUser(createUserOpt) 
                }) 
}).then((user) => { 
    channel = client.newChannel(options.channel_id); 
    let data = fs.readFileSync(options.peer0_org1_tls_cacerts); 
    let peer = client.newPeer(options.peer0_org1_url, 
        { 
            pem: Buffer.from(data).toString(), 
            'ssl-target-name-override': options.server_hostname //因为启用了TLS，所以上面的代码就是指定Peer的TLS的CA证书 
        } 
    ); 
	channel.addPeer(peer); //节点peer0.org1加入channel
	
	//由于安装智能合约时指定了"AND ('Org1MSP.peer','Org2MSP.peer')"，即需要两个MSP背书才能通过
	let data1 = fs.readFileSync(options.peer0_org2_tls_cacerts);
	let peer1 = client.newPeer(options.peer0_org2_url, 
        { 
            pem: Buffer.from(data1).toString(), 
            'ssl-target-name-override': options.server1_hostname 
        } 
    ); 
	channel.addPeer(peer1); //节点peer0.org2加入channel
    
	
    //接下来连接Orderer的时候也启用了TLS，也是同样的处理方法 
    let odata = fs.readFileSync(options.orderer_tls_cacerts); 
    let caroots = Buffer.from(odata).toString(); 
    var orderer = client.newOrderer(options.orderer_url, { 
        'pem': caroots, 
        'ssl-target-name-override': "orderer.example.com" 
    }); 
    
    channel.addOrderer(orderer); 
    targets.push(peer);
	targets.push(peer1);
    return; 
}).then(() => { 
    tx_id = client.newTransactionID(); 
    console.log("Assigning transaction_id: ", tx_id._transaction_id);
	
	//增加键值test,值为1000(需要修改智能合约，添加add接口)
    var request = { 
        targets: targets, 
        chaincodeId: options.chaincode_id, 
        fcn: 'add', 
        args: ['test', '10000'], 
        chainId: options.channel_id, 
        txId: tx_id 
    }; 
	//https://fabric-sdk-node.github.io/Channel.html#sendTransactionProposal
    return channel.sendTransactionProposal(request);//向一个或多个peer发起交易提案
}).then((results) => { 
    var proposalResponses = results[0];	
    var proposal = results[1]; 
    //var header = results[2]; 
	console.log(proposalResponses);
	console.log(proposal);
	//console.log(header);

    let isProposalGood = false; 
    if (proposalResponses && proposalResponses[0].response && 
        proposalResponses[0].response.status === 200) { 
        isProposalGood = true; 
        console.log('transaction proposal was good'); 
    } else { 
        console.error('transaction proposal was bad'); 
    } 
    if (isProposalGood) { 
        console.log(util.format( 
            'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s', 
            proposalResponses[0].response.status, proposalResponses[0].response.message, 
            proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature)); 
        var request = { 
            proposalResponses: proposalResponses, 
            proposal: proposal
            //header: header 
        }; 
        // set the transaction listener and set a timeout of 30sec 
        // if the transaction did not get committed within the timeout period, 
        // fail the test 
        var transactionID = tx_id.getTransactionID(); 
        var eventPromises = []; 
        let eh = client.newEventHub(); 
        //接下来设置EventHub，用于监听Transaction是否成功写入，这里也是启用了TLS 
        let data = fs.readFileSync(options.peer0_org1_tls_cacerts); 
        let grpcOpts = { 
             pem: Buffer.from(data).toString(), 
            'ssl-target-name-override': options.server_hostname 
        } 
        eh.setPeerAddr(options.event_url,grpcOpts); 
        eh.connect();

        let txPromise = new Promise((resolve, reject) => { 
            let handle = setTimeout(() => { 
                eh.disconnect(); 
                reject(); 
            }, 30000); 
			//向EventHub注册事件的处理办法 
            eh.registerTxEvent(transactionID, (tx, code) => { 
                clearTimeout(handle); 
                eh.unregisterTxEvent(transactionID); 
                eh.disconnect();

                if (code !== 'VALID') { 
                    console.error( 
                        'The transaction was invalid, code = ' + code); 
                    reject(); 
                 } else { 
                    console.log( 
                         'The transaction has been committed on peer ' + 
                         eh._ep._endpoint.addr); 
                    resolve(); 
                } 
            }); 
        }); 
        eventPromises.push(txPromise); 
		//https://fabric-sdk-node.github.io/Channel.html#sendTransaction__anchor
        var sendPromise = channel.sendTransaction(request); //向orderer发送正式交易
        return Promise.all([sendPromise].concat(eventPromises)).then((results) => { 
            console.log(' event promise all complete and testing complete'); 
             return results[0]; // the first returned value is from the 'sendPromise' which is from the 'sendTransaction()' call 
        }).catch((err) => { 
            console.error( 
                'Failed to send transaction and get notifications within the timeout period---.' 
            ); 
            return 'Failed to send transaction and get notifications within the timeout period.'; 
         }); 
    } else { 
        console.error( 
            'Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...' 
        ); 
        return 'Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...'; 
    } 
}, (err) => { 
    console.error('Failed to send proposal due to error: ' + err.stack ? err.stack : 
        err); 
    return 'Failed to send proposal due to error: ' + err.stack ? err.stack : 
        err; 
}).then((response) => { 
    if (response.status === 'SUCCESS') { 
        console.log('Successfully sent transaction to the orderer.'); 
        return tx_id.getTransactionID(); 
    } else { 
        console.error('Failed to order the transaction. Error code: ' + response.status); 
        return 'Failed to order the transaction. Error code: ' + response.status; 
    } 
}, (err) => { 
    console.error('Failed to send transaction due to error: ' + err.stack ? err 
         .stack : err); 
    return 'Failed to send transaction due to error: ' + err.stack ? err.stack : 
        err; 
});