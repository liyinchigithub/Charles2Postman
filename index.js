var fs = require('fs');
var join = require('path').join;
var path = require('path');
var log4js = require('log4js');
var logger = log4js.getLogger();
logger.level = 'info';

// 思路：把chlsj中的数据，抓出来构建成一个postman collection.json文件 
var charles2postman = {
    /**
     * @method 遍历指定路径，获取所有路径下的文件夹、文件名称
     * @param jsonPath 被遍历的文件夹路径
    */
    getFilesName: (jsonPath) => {
        // 空数组，用于存放获取的每个文件的路径
        let jsonFiles = [];
        let findJsonFile = (path) => {
            // 读取根节点文件夹，返回文件数组列表
            let files = fs.readdirSync(path);
            // 调试输出
            logger.info("返回文件数组列表:" + files);
            // 遍历文件数组列表
            files.forEach(function (item, index) {
                let fPath = join(path, item);
                // 根据文件路径获取文件信息，返回一个fs.Stats对象
                let stat = fs.statSync(fPath);
                // 判断是文件夹，还是文件
                if (stat.isDirectory() === true) {
                    // 是文件夹
                    // 递归！
                    findJsonFile(fPath);
                };
                if (stat.isFile() === true) {
                    // 针对mac系统，判断是否包含隐藏文件DS_Store
                    if (item.indexOf("DS_Store") != -1) {
                        // 含有隐藏文件不放入fPath
                        // console.log("item",item)
                    } else {
                        // 是文件，放入数组中
                        jsonFiles.push(fPath);
                    }





                };
            });
        }
        findJsonFile(jsonPath);//jsonPath.length()及时文件数量
        // 调试输出 数组内容
        logger.info(jsonFiles);


        // 判断文件数量，根据文件数量决定要写入的对象，每个对象元素就是一个item，每个item获取不同文件的content！
        let items = [];


        // 遍历读取文件内容
        jsonFiles.forEach(filedir => {
            // 读取charles导出抓包请求数据
            var requestsCharles = JSON.parse(fs.readFileSync(filedir, 'utf-8'));//fs读取文件，返回内容是字符串，需要转成对象
            // 调试输出
            // logger.info(requestsCharles);
            // let requestItme = requestsCharles[0] ;
            let requests = requestsCharles.map(requestItme=>{

	            /**
	             * 解析path，拆分成数组（即File文件夹下的每个chlsj文件名）
	             * */
	            var path = requestItme["path"].split("/");// 将path参数，拆分成数组
	            logger.info(path.filter(n => n));// 删除数组数组中空元素
	            /**
	             * 解析header
	             * requestItme["request"]["header"]["headers"]
	             */
	            var header = [];
	            var content_header = requestItme["request"]["header"]["headers"];// 获取charles导出抓包请求数据中，headers的数组元素
	            // 遍历headers每个元素，拼接成导入postman collection.json支持的数据header格式
	            content_header.forEach(element => {
	                // 调试输出
	                // logger.info("element:"+JSON.stringify(element));
	                header.push({
	                    "key": element["name"],
	                    "name": element["name"],
	                    "value": element["value"],
	                    "type": "text"
	                });
	            });
	            // 调试输出
	            // logger.info(JSON.stringify(header));

	            /**
	             * 判断请求方法类型%content-type（body内容类型），解析出相应body格式。
	             */
	            var body = {};
	            var mimeType = requestItme["request"]["mimeType"];
	            var raw;
	            var RAW;
	            // 如果请求method是get或Get或GET，则body直接为空
	            if (requestItme["method"] === "GET") {
	                body = {};
	                // 但参数都在地址栏，因此query不为null，即host地址需要拼接成host?query
	                raw = requestItme["host"] + requestItme["path"] + "?" + requestItme["query"];
	                // console.log("raw",raw)
	                // 判断是否非null（因为有些GET请求是不带param即query值为null）
	                if (requestItme["query"]!=null) {
	                // 将get请求url参数params转成query [{"key":"xxx","value":"xxx"},{"key":"xxx","value":"xxx"},{"key":"xxx","value":"xxx"}]
	                var query = [];
	                var keys = [];
	                var values = [];
	                var changeQuery = requestItme["query"].replace(/=/g, ":").replace(/&/g, ",").split(",")
	                // console.log("changeQuery", changeQuery)
	                var array = changeQuery;
	                // 获取所有key的数组
	                for (let index = 0; index < array.length; index++) {
	                    const element = array[index];
	                    var wz = element.indexOf(':');
	                    var res = element.substring(0, wz);
	                    // console.log("key", res)
	                    keys.push(res);
	                }
	                // 获取所有values的数组
	                for (let index = 0; index < array.length; index++) {
	                    const element = array[index];
	                    var wz = element.indexOf(':');
	                    var res = element.substring(wz + 1, element.size);
	                    // console.log("value", res)
	                    values.push(res);
	                }


	                for (let index = 0; index < array.length; index++) {
	                    const key = keys[index];
	                    const value = values[index];
	                    query.push({ "key": key, "value": value })
	                }
	                }

	            } else {
	                // post、put、delete等方法url不带参数?
	                raw = requestItme["host"] + requestItme["path"];
	                // method非GET，那么Method可能是POST、PUT、DELETE、OPTIONS，也就存在body，body类型有urlencoded、json、form-data等格式
	                if (mimeType === "application/json") {
	                    // content-type为application/json
	                    logger.info("Content-type:application/json");
	                    logger.info(requestItme["request"]["body"]["text"]);
	                    body = {
	                        "mode": "raw",
	                        "raw": requestItme["request"]["body"]["text"],
	                        "options": {
	                            "raw": {
	                                "language": "json"
	                            }
	                        }
	                    }
	                } else if (mimeType === "multiple/form-data") {
	                    // content-type为multiple/form-data
	                    logger.info("Content-type:multiple/form-data");
	                    // 将x=x&y=y格式转成对象
	                    var params = requestItme["request"]["body"]["text"];
	                    var paramArr = params.split('&');
	                    var res = {};
	                    for (var i = 0; i < paramArr.length; i++) {
	                        var str = paramArr[i].split('=');
	                        res[str[0]] = str[1];
	                    }
	                    logger.info("body：" + JSON.stringify(res));
	                    // 用于存放拼接成postman collection.json 支持导入的body格式的数据
	                    var form_data_body = [];
	                    var object = res;
	                    // 因为body的属性和属性值，可能有多个，所以遍历获取每组对象。
	                    for (const key in object) {
	                        if (object.hasOwnProperty(key)) {
	                            const element = object[key];
	                            // 调试输出key
	                            // logger.info(key);
	                            // 调试输出value
	                            // logger.info(element);
	                            // 拼接成postman collection.json 支持导入的body格式。即放入数组中
	                            form_data_body.push({
	                                "type": "text",
	                                "key": key,
	                                "value": element
	                            });
	                        }
	                    }
	                    // content-type为multiple/form-data
	                    // 解析body格式为
	                    body = {
	                        "mode": "formdata",
	                        "formdata": form_data_body
	                    }
	                } else if (mimeType === ("application/x-www-form-urlencoded")) {
	                    // content-type为application/x-www-form-urlencoded
	                    logger.info("application/x-www-form-urlencoded");
	                    // 将x=x&y=y格式转成对象
	                    var params = requestItme["request"]["body"]["text"];
	                    var paramArr = params.split('&');
	                    var res = {};
	                    for (var i = 0; i < paramArr.length; i++) {
	                        var str = paramArr[i].split('=');
	                        res[str[0]] = str[1];
	                    }
	                    logger.info("body：" + JSON.stringify(res));
	                    // 用于存放拼接成postman collection.json 支持导入的body格式的数据
	                    var urlencoded_body = [];
	                    var object = res;
	                    // 因为body的属性和属性值，可能有多个，所以遍历获取每组对象。
	                    for (const key in object) {
	                        if (object.hasOwnProperty(key)) {
	                            const element = object[key];
	                            // 调试输出key
	                            // logger.info(key);
	                            // 调试输出value
	                            // logger.info(element);
	                            // 拼接成postman collection.json 支持导入的body格式。即放入数组中
	                            urlencoded_body.push({
	                                "type": "text",
	                                "key": key,
	                                "value": element
	                            });
	                        }
	                    }

	                    // 解析body格式为
	                    body = {
	                        "mode": "urlencoded",
	                        "urlencoded": urlencoded_body
	                    }
	                }
	            }
	            // 判断是否GET，如果是把raw接入到后面raw
	            if (requestItme["method"] === "GET") {
	                RAW = raw
	            } else {
	                RAW = requestItme["host"] + requestItme["path"]
	            }


	            // 将每个文件夹对应的item内容对象，放入item数组中，用于下面最终postman_json写入postman_collection.json文件中
	            // items.push( );
	            return {
	                "name": requestItme["path"],
	                "event": [{
	                    "listen": "test",
	                    "script": {
	                        "id": "e7784559-3290-488c-a4fd-f241268ceed5",
	                        "exec": ["//断言", "pm.test(\"Status code is 200\", function () {", "    pm.response.to.have.status(200);", "});"],
	                        "type": "text/javascript"
	                    }
	                }],
	                "protocolProfileBehavior": {
	                    "disableBodyPruning": true
	                },
	                "request": {
	                    "method": requestItme["method"],
	                    "header": header,
	                    "body": body,
	                    "url": {
	                        "raw": RAW,
	                        "host": `${requestItme["scheme"]}://${requestItme["host"]}`,
	                        "path": path,
	                        "query": query
	                    },

	                },
	                "response": []
	            }
            })
			items = items.concat( requests )

            // 调试输出每个文件夹解析出来的item内容
            // logger.info(JSON.stringify(items));

        });
        // postman导入格式
        var postman_json = {
            "info": {
                "_postman_id": "a33a6a47-a9e8-4e6f-ab83-7cb1a25d4456",
                "name": "File",
                "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
            },
            "item": items
        }
        // 输出到outputFile
        fs.writeFile("./outputFile/postman_collection.json", JSON.stringify(postman_json), (err, data) => {
            logger.info("转换完毕");
        });
    },

    /**
     * @method  遍历的指定路径下的文件夹、文件结构，转成json串
     * @param   dir  被遍历的指定路径 path
     * @param   deep 文件目录深度，默认3
     * @returns
     * */

    // 获取指定路径 path 下的，默认深度为 3 的目录 JSON
    getIndexByPath: (dir, deep = 3) => {
        let dirDevide = dir.split('/');
        let preDir = dirDevide.splice(0, dirDevide.length - 1).join('/');
        let index = {};
        charles2postman.getIndexOfPathByDeep(index, path.join(__dirname, preDir), dirDevide[0], deep + 1);
        return index;
    },
    // 开始对指定 path 递归查找深度为 deep 深度
    getIndexOfPathByDeep: (obj, dir, curDir, deep) => {
        let curPath = path.join(dir, curDir);
        // 达到搜索深度，停止
        if (deep) {
            obj[curDir] = curDir;
            if (fs.statSync(curPath).isDirectory()) {
                obj[curDir] = {};
                let lists = fs.readdirSync(curPath);
                lists.forEach(list => charles2postman.getIndexOfPathByDeep(obj[curDir], curPath, list, deep - 1))
            }
        }
    }
}
charles2postman.getFilesName("./File");// 获取文件夹中所有文件夹名、文件名，返回数组
// var json=charles2postman.getIndexByPath("./File",50);
// logger.info(JSON.stringify(json));
