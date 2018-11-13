/**
  *TODO:
  * 1.  Classificador Geral do Google
  * 2.  Classificador de documento IBM
  * 3.  OCR GOOGLE
  * 3.1 Processamento do OCR, Tamanho médio do Lenght, Regex(CPF e CPNJ) e pelo padrão extrair o nome do dono
  */

const vision = require('@google-cloud/vision');
require('dotenv').config();
var fs = require('fs');

var VisualRecognitionV3 = require('watson-developer-cloud/visual-recognition/v3');

// console.log(process.env.WATSON_VERSION);
// console.log(process.env.WATSON_APIKEY);
// console.log(process.env.WATSON_CUSTOM_MODEL_ID);

const WATSON_VERSION = "2018-03-19";
const WATSON_APIKEY = "v07k2_3vGe2qm6m-fHaTupvG7RRICGS0VTJH5xiNYstV";
const WATSON_CUSTOM_MODEL_ID = "Documentos_204825301";

const fileFolder = "public/images/cnh/";
const fileName = "cnh2.jpg";
// const fileFolder = "resources/";
// const fileName = "pizza.jpg";
const filePath = fileFolder + fileName;
//const filePath = "https://p2.trrsf.com/image/fget/cf/460/0/images.terra.com/2018/05/25/dicas-para-requentar-a-pizza-amanhecida.jpg";
var file = fs.createReadStream(filePath);

// Creates Google client
const client = new vision.ImageAnnotatorClient();

//Watson Visual recognition
var visualRecognition = new VisualRecognitionV3({
    version: WATSON_VERSION,
    iam_apikey: WATSON_APIKEY
  });

//Paramentros necessario para utilizar o modelo custom do watson
var params = {
  images_file: file,
  classifier_ids: [WATSON_CUSTOM_MODEL_ID],
  owners: ["me"],
  threshold: 0.5
};

const tabela_pontuacao = {"identity document" : 1, "product" : 0.3, "text" : 0.7}

//Label Detection Google
function googleLabel (res) {
    client
      .labelDetection(filePath)
      .then(results => {
        const annotations = results[0].labelAnnotations;
        // console.log(JSON.stringify(results));
        let labels = [];
        let pontuacao = 0;
        annotations.forEach(function(item){
            const classe = item.description;
            let valor = tabela_pontuacao[classe];
            if (valor){
                pontuacao += valor
            }
            labels.push(item.description);
        });
        console.log(`Classes encontradas: ${labels}`);
        console.log(`Pontuação total: ${pontuacao}`);
        if (pontuacao >= 1) {
            classificador_documento(res);
        }else{
            console.log("Não consegui indentificar um documento de CNH, por favor tirar foto de uma CNH ou tirar de outro ângulo que facilite a indentificação. Negado pela label detection");
            let responseJson = createJSON(false, "Negativo", null);
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(responseJson));
            return responseJson;
        }
      })
      .catch(err => {
        console.error('ERROR:', err);
      });
}

function classificador_documento(res) {
    //Requisicao do Watson
    visualRecognition.classify(params, function(err, response) {
        if (err){
            console.log(err);
        }
        else{
            console.log('-----------------------------WATSON--------------------------');
            // console.log(JSON.stringify(response, null, 2));;
            const image = response.images[0];
            const classes = image.classifiers[0].classes;
            const classification = [];
            classes.forEach(function(item){
                const class_i = item.class;
                //TODO concertar esse item.class que ta dando uma bronca
                const score = item.score;
                const tuple = [class_i,score];
                classification.push(tuple);
            });
            console.log(classification);
            if(classification.length > 0){
                if (classification[0][0] === "CNH" && classification[0][1] > 0.5){
                    ocr(res);
                    return;
                }else{
                    let responseJson = createJSON(true, classification[0][0], null);
                    res.setHeader('Content-Type', 'application/json');
                    res.send(JSON.stringify(responseJson));
                    return responseJson;
                }
            }
            console.log("CNH não indenficada, por favor tirar foto de uma CNH ou tirar de outro ângulo que facilite a indentificação. Negado pela classificação Watson");
            let responseJson = createJSON(true, "Negativo", null);
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(responseJson));
            return responseJson;
        }
    });
}

function ocr(res) {
    // OCR Google
    client
    .textDetection(filePath)
    .then(results => {
        try{
            console.log('-----------------------------OCR--------------------------');
            const text = results[0].fullTextAnnotation.text; //pegar o texto todo
            //extrair informacoes do texto inteiro
            const nome = extrair_nome(text);
            const cpf = extrair_cpf(text);
            let lista_datas = extrair_datas(text);
            let data_nasc = lista_datas[0]
            let primeira_hab = lista_datas[1]
            let validade = lista_datas[2]
            let emissao = lista_datas[3]
            //imprimir as informacoes
            console.log(`cpf: ${cpf}`);
            console.log(`Nome: ${nome}`);
            console.log(`Data Nascimento ${data_nasc}`);
            console.log(`Primeira Habilitação ${primeira_hab}`);
            console.log(`Validade ${validade}`);
            if (emissao) {
                console.log(`Data Emissão ${emissao}`);
                const cnh = createCnh(cpf, nome, data_nasc, primeira_hab, validade, emissao);
            }else{
                const cnh = createCnh(cpf, nome, data_nasc, primeira_hab, validade, null);
            }
            let responseJson = createJSON(true, "CNH", cnh);
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(responseJson));
            return responseJson;
        }catch(e){
            console.log('ERROR:', e)
            let responseJson = createJSON(true, "CNH", null);
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(responseJson));
            return responseJson;
        }

    })
    .catch(err => {
        console.error('ERROR:', err);
    });
}

const regex_data = /([0-2][0-9]|(3)[0-1])(\/)(((0)[0-9])|((1)[0-2]))(\/)[1-2]\d{3}/g;
const regex_cpf = /[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}/g;

function extrair_cpf(texto) {
    const cpf = texto.match(regex_cpf)[0];
    return cpf;
}

function extrair_datas(texto) {
    //aplicar regex
    const lista_datas = texto.match(regex_data);
    //transformar String em Date para ordenar
    let datas = []
    lista_datas.forEach(function(str_data){
        let data = toDate(str_data);
        datas.push(data);
    });
    //ordenar
    const datas_ordenadas = datas.sort(function (date1, date2) {
        if (date1 > date2) return -1;
        if (date1 < date2) return 1;
        return 0;
    });
    //obter datas
    const data_nasc = datas_ordenadas[datas_ordenadas.length-1];
    const primeira_hab = datas_ordenadas[datas_ordenadas.length-2];
    const validade = datas_ordenadas[0];
    let emissao = null
    if (datas.length === 4) {
        emissao = datas_ordenadas[datas_ordenadas.length-3];
    }
    //retornar
    return [data_nasc, primeira_hab, validade, emissao]
}

function toDate(dateStr) {
    const [day, month, year] = dateStr.split("/")
    return new Date(year, month - 1, day)
}

function extrair_nome(texto) {
    console.log(texto)
    let pre_nome = texto.split("NOME\n")[1];
    const nome = pre_nome.split("\nDOC")[0];
    return nome;
}

function createCnh(cpf, nome, data_nasc, primeira_hab, validade, emissao) {
    let cnh = {
            "nome" : "fulano",
            "dataNascimento" : data_nasc.toLocaleDateString(),
            "dataValidade" : validade.toLocaleDateString(),
            "primeiraHabilitacao": primeira_hab.toLocaleDateString(),
            "CPF" : cpf
        };
    if (emissao) {
        cnh.dataEmissao = emissao.toLocaleDateString();
    }
}


function createJSON (isDocumento, classificacao, cnh) {
    let resJson = {
        "isDocumento" : isDocumento,
        "classificacao" : classificacao,
        "cnh" : cnh
    }
    return resJson;
}

module.exports ={googleLabel, classificador_documento, ocr, extrair_cpf, extrair_datas, toDate, extrair_nome};