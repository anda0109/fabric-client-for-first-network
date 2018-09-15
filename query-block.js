'use strict';

var hfc = require('fabric-client'); 
var path = require('path'); 
var sdkUtils = require('fabric-client/lib/utils') 
var fs = require('fs'); 
var options = { 
    user_id: 'Admin@org1.example.com', 
    msp_id:'Org1MSP', 
    channel_id: 'mychannel', 
    chaincode_id: 'mycc', 
    network_url: 'grpcs://192.168.2.177:7051',//因为启用了TLS，所以是grpcs,如果没有启用TLS，那么就是grpc 
    privateKeyFolder:'./crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore', 
    signedCert:'./crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/Admin@org1.example.com-cert.pem', 
    tls_cacerts:'./crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt', 
    server_hostname: "peer0.org1.example.com" 
};

var channel = {}; 
var client = null; 
const getKeyFilesInDir = (dir) => { 
//该函数用于找到keystore目录下的私钥文件的路径 
    var files = fs.readdirSync(dir) 
    var keyFiles = [] 
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
  signedCert: options.signedCert } 
        } 
//以上代码指定了当前用户的私钥，证书等基本信息 
return sdkUtils.newKeyValueStore({ 
                        path: "/tmp/fabric-client-stateStore/" 
                }).then((store) => { 
                        client.setStateStore(store) 
                         return client.createUser(createUserOpt) 
                 }) 
}).then((user) => { 
    channel = client.newChannel(options.channel_id); 
    
    let data = fs.readFileSync(options.tls_cacerts); 
    let peer = client.newPeer(options.network_url, 
         { 
            pem: Buffer.from(data).toString(), 
            'ssl-target-name-override': options.server_hostname 
        } 
    ); 
    peer.setName("peer0"); 
    //因为启用了TLS，所以上面的代码就是指定TLS的CA证书 
    channel.addPeer(peer);
	
	//查询区块
	var block = channel.queryBlock(1);
	block.then(function(value){
		//success
		console.log("\nBlock 1:\n");
		console.log(JSON.stringify(value));
	},function(value){
		//fail
		console.log('fail');
	});
	
	//查询blockinfo
	var info = channel.queryInfo();
	info.then(function(value){
		//success
		console.log("\nblockchaininfo:\n");
		console.log(JSON.stringify(value));
	},function(value){
		//fail
		console.log('fail');
	});
	
	//查询tx
	var tx = channel.queryTransaction('8cf41f11eeb1918510d6c83bee698e38e1bde1a845245b63a67d89af192836f8');
	tx.then(function(value){
		//success
		console.log("\ntransaction:\n");
		console.log(JSON.stringify(value));
	},function(value){
		//fail
		console.log('fail');
	});
	
    return; 
}).then(() => { 
    console.log("Make query"); 
    var transaction_id = client.newTransactionID(); 
    console.log("Assigning transaction_id: ", transaction_id._transaction_id); 
	//构造查询request参数 
    const request = { 
        chaincodeId: options.chaincode_id, 
        txId: transaction_id, 
        fcn: 'query', 
        args: ['tangshengwu'] 
    }; 
     return channel.queryByChaincode(request); 
}).then((query_responses) => { 
    console.log("returned from query"); 
    if (!query_responses.length) { 
        console.log("No payloads were returned from query"); 
    } else { 
        console.log("Query result count = ", query_responses.length) 
    } 
    if (query_responses[0] instanceof Error) { 
        console.error("error from query = ", query_responses[0]); 
    } 
    console.log("Response is ", query_responses[0].toString());//打印返回的结果 
}).catch((err) => { 
    console.error("Caught Error", err); 
});
