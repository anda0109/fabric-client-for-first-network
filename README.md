# fabric-client-for-first-network
用以和fabric-samples下的firstr-network网络进行通信，调用智能合约查询和写入数据。

# 使用方法
1、克隆代码

git clone https://github.com/anda0109/fabric-client-for-first-network.git

cd fabric-client-for-first-network

2、将first-network下的证书文件夹crypto-config拷贝到fabric-client-for-first-network目录下

3、安装node依赖

npm install

4、运行

运行前注意将文件中的ip地址改为自己部署的first-network环境的地址。

node query.js
