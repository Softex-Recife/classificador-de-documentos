var express = require('express');
var router = express.Router();
var utils = require('../utils/classificarDocumentos');

/* GET home page. */
router.get('/', function(req, res, next) {
  //res.render('index', { title: 'Express' });
  	responseJson = utils.googleLabel(res);

    // res.setHeader('Content-Type', 'application/json');
    // console.log(responseJson);
    // res.send(JSON.stringify(responseJson));
//     res.send(JSON.stringify({
// 		"isDocumento" : "true",
// 		"classificacao" : "CNH",
// 		"cnh" : {
// 			"nome" : "fulano",
// 			"dataNascimento" : "13/11/2018",
// 			"dataValidade" : "13/11/2018",
// 			"dataEmissao": "13/11/2018",
// 			"primeiraHabilitacao": "13/11/2018",
// 			"CPF" : "103.331.153-18"
// 		}
// 	}));

});

module.exports = router;
