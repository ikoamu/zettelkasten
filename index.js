const sqlite3 = require('sqlite3').verbose();

// データベースを開く
const db = new sqlite3.Database('./org-roam.db');

function parseProperties(s) {
    let matches = s.match(/\"(.*?)\" \. \"(.*?)\"/g);
    let properties = {};
    for (let match of matches) {
        let [key, value] = match.match(/\"(.*?)\"/g).map(v => v.replace(/"/g, ''));
        properties[key] = value;
    }
    const removed = removeQuotesFromObject(properties);
    return {
        ...removed,
        FILE: getFilename(removed.FILE),
    }
}

function removeQuotesFromObject(obj) {
    for (let key in obj) {
        if (typeof obj[key] === 'string') {
            obj[key] = obj[key].replace(/^"|"$/g, '');
        } else if (typeof obj[key] === 'object') {
            obj[key] = removeQuotesFromObject(obj[key]);
        }
    }
    return obj;
}

function getFilename(path) {
    return path.split('/').pop();
}

// SELECT文を実行する
const graphdata = {
    type: "graphdata",
    data: {},
};
db.all(`
SELECT
    tags.tag as tags,
    nodes.properties,
    nodes.olp,
    nodes.pos,
    nodes.level,
    nodes.title,
    nodes.file,
    nodes.id
FROM
    nodes
LEFT JOIN
    tags
ON
    nodes.id = tags.node_id
GROUP BY
    nodes.id
`, (_, nodes) => {
    db.all(`
SELECT
    type, dest as target, source
FROM
    links
WHERE
    type = '"id"'
    `, (_, links) => {
        db.all(`
SELECT
    *
FROM
    tags
`, (_, tags) => {
        graphdata.data.nodes = nodes.map(node => ({
            ...node,
            tags: node.tags ?? [null],
            file: getFilename(node.file),
            properties: parseProperties(node.properties),
        }));
        graphdata.data.links = links;
        graphdata.data.tags = tags.length ? tags : null;
        // graphdataをファイルに書き出す
        const fs = require('fs');
        fs.writeFile('graphdata.json', JSON.stringify(removeQuotesFromObject(graphdata), null, 2), (err) => {
            if (err) throw err;
            console.log('The file has been saved!');
        });
        });
    });
});

// データベースを閉じる
db.close();
