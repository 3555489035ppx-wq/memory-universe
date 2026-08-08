import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(projectRoot, 'public/demo/demo-memories.json');
const createdAt = '2026-08-04T00:00:00.000Z';

const peopleNames = ['林夏', '陈屿', '周舟', '宋宁', '苏禾', '许言', '陆遥', '顾然'];
const placeNames = ['上海', '杭州', '厦门', '成都', '苏州', '青岛', '北京', '昆明'];
const placeCoordinates = [
  [31.2304, 121.4737],
  [30.2741, 120.1551],
  [24.4798, 118.0894],
  [30.5728, 104.0668],
  [31.2989, 120.5853],
  [36.0671, 120.3826],
  [39.9042, 116.4074],
  [25.0389, 102.7183],
];
const moods = ['happy', 'calm', 'nostalgic', 'excited', 'chaotic', 'lonely'];
const titles = [
  '雨停后的路口', '窗边的早餐', '沿江散步', '晚班地铁', '第一次见海', '旧书店二楼',
  '厨房里的桂花', '山路转弯处', '夏夜天台', '清晨菜场', '外婆家的午后', '毕业前一晚',
  '风吹过操场', '错过的末班车', '老相机里的春天', '一桌没吃完的菜', '落日落在屋顶', '雨伞下的两个人',
  '车窗外的稻田', '凌晨四点的便利店', '冬天第一场雪', '在码头等风', '搬家那天', '走散又重逢',
  '没有寄出的明信片', '公园长椅', '台风来之前', '旧剧院散场', '巷口的花店', '生日蜡烛熄灭后',
  '河岸自行车', '第一次独自旅行', '妈妈的旧围巾', '演出开始前', '玻璃上的雾气', '车站送别',
  '山顶的热茶', '朋友家的猫', '绕远路回家', '海边的早餐店', '收音机里的歌', '雨后的上海',
  '看完电影以后', '凌晨的出租车', '晒干的床单', '院子里的石榴树', '最后一张合照', '春分那天',
  '从桥上看城市', '午睡醒来的光', '海浪盖过脚印', '新房子的第一顿饭', '在机场写下的字', '旧校门口',
  '咖啡冷掉之前', '被风吹乱的花', '夜市尽头', '窗外飞过的鸟', '告别夏天', '回家路上的月亮',
];
const descriptions = [
  '雨刚停，路面把商店的灯完整地倒映出来。',
  '我们没有说话，只听见杯子碰到木桌的声音。',
  '江面很慢，整座城市像被暂时按下了静音。',
  '最后一班车里只剩几个人，彼此都没有抬头。',
  '海风比想象中更咸，鞋里很快进了细沙。',
  '木楼梯会响，老板把找不到出处的书放在最高层。',
  '桂花落进水池里，厨房一整天都有微甜的气味。',
  '转过弯之后没有景点，只有山雾和一排晾衣绳。',
  '停电十分钟，我们第一次认真看见整片夜空。',
  '摊主把青菜上的水甩到地面，天还没有完全亮。',
  '风扇一直转，外婆在旧藤椅上讲同一个故事。',
  '所有人都装作平常，桌上却摆满了不会再用的票根。',
  '跑道边的树叶发出很大的声音，广播站正在放旧歌。',
  '我们站在站牌下等了很久，最后决定走回去。',
  '底片有一道划痕，却刚好穿过春天最亮的地方。',
  '人都走了，盘子里还留着一块没有人认领的蛋糕。',
  '屋顶不高，落日却把每扇窗都照成了金色。',
  '伞太小，肩膀湿了一半，回想起来却只记得笑声。',
  '列车开得很快，稻田在玻璃后面连成一条绿色的河。',
  '店员在补货，我们坐在窗边等天慢慢变亮。',
  '雪落得很轻，脚步声反而比平时更清楚。',
  '船还没有来，风把每个人的衣角吹向同一个方向。',
  '纸箱堆在门口，旧钥匙放在了最后一个抽屉。',
  '人群散开以后，我们在同一块广告牌下重新看见彼此。',
  '明信片写完后一直夹在书里，地址已经失效。',
  '长椅掉了漆，旁边的树影每隔几分钟换一种形状。',
  '天空压得很低，街上的人把招牌一块块收回店里。',
  '灯亮起来时，大家才发现外面已经下雨。',
  '花店快打烊了，老板把剩下的花摆到门口。',
  '蜡烛熄灭后，房间里还留着一小段烟。',
  '车轮沿着河岸慢慢转，晚风把说过的话都留在身后。',
  '背包比预想中沉，真正走出车站时却忽然轻松下来。',
  '围巾边缘已经起毛，洗过以后还是有熟悉的皂香。',
  '台下还没有人，舞台灯先照亮了空气里的灰尘。',
  '我们在玻璃上写下名字，暖气吹来以前又一起擦掉。',
  '列车开动后，他仍站在原地，直到站台被转弯挡住。',
  '风很冷，纸杯里的茶却让手心一直保持温度。',
  '它第一次见我就跳上窗台，假装只是路过。',
  '那天谁都不赶时间，于是把熟悉的路走成了远方。',
  '老板每天六点开门，海浪声比咖啡机更早醒来。',
  '旋钮转过一段噪声，忽然听见很多年前唱过的副歌。',
  '雨把高楼的边缘洗得很轻，路灯在水面里多出一座城。',
  '字幕结束后没有立刻离开，我们在空走廊里讨论结局。',
  '司机把广播调得很小，凌晨的街道从车窗两边退去。',
  '床单被太阳晒得发白，收下来时还带着风的形状。',
  '石榴还没熟，外公已经在树下算今年能分给几个人。',
  '按下快门前有人闭眼，后来却成了我们最常看的那张。',
  '花开得并不整齐，光从枝叶之间落在每个人肩上。',
  '站在桥中间，熟悉的街区第一次看起来像另一座城市。',
  '醒来时房间很安静，一小块阳光刚好停在枕边。',
  '我们故意走得很慢，还是没能留住被潮水抹平的脚印。',
  '桌椅都还没到，几个人围着纸箱吃完了第一顿晚饭。',
  '航班一次次延误，写下的句子也从抱怨慢慢变成告别。',
  '门口的树长高了，值班室的窗帘却还和从前一样。',
  '说好只坐十分钟，等回过神来杯底已经没有温度。',
  '花瓣被风吹得四散，我们追了几步，最后只是站着看。',
  '最后一个摊位正在收灯，油烟和笑声一起飘进夜里。',
  '它掠过窗框只用了一秒，影子却在墙上停得更久。',
  '海水已经转凉，沙滩上的人比上个月少了一半。',
  '月亮一路在楼顶之间出现又消失，直到钥匙插进家门。',
];
const tagGroups = [
  ['城市', '雨'], ['家人', '早餐'], ['散步', '河流'], ['夜晚', '交通'],
  ['旅行', '海边'], ['阅读', '旧物'], ['家', '气味'], ['山', '雾'],
  ['朋友', '夏天'], ['日常', '清晨'], ['家人', '旧家'], ['朋友', '告别'],
];
const colors = [
  [126, 111, 95], [188, 160, 112], [89, 118, 123], [72, 79, 91],
  [114, 151, 162], [133, 103, 80], [168, 139, 78], [91, 112, 94],
  [103, 91, 127], [148, 111, 83], [118, 95, 73], [96, 107, 118],
];

const people = peopleNames.map((name, index) => ({
  id: `demo-person-${String(index + 1).padStart(2, '0')}`,
  source: 'demo',
  name,
  createdAt,
  updatedAt: createdAt,
}));

const places = placeNames.map((name, index) => ({
  id: `demo-place-${String(index + 1).padStart(2, '0')}`,
  source: 'demo',
  name,
  latitude: placeCoordinates[index][0],
  longitude: placeCoordinates[index][1],
  createdAt,
  updatedAt: createdAt,
}));

const memories = titles.map((title, index) => {
  const number = String(index + 1).padStart(3, '0');
  const pair = Math.floor(index / 2);
  const year = 2022 + Math.floor(pair / 8);
  const month = (pair % 12) + 1;
  const day = (pair % 23) + 1;
  const hour = index % 2 === 0 ? 9 : 18;
  const capturedAt = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:20:00`;
  const personIndex = pair % people.length;
  const secondPersonIndex = (personIndex + 3) % people.length;
  const rgb = colors[index % colors.length];
  const photoPath = `/demo/photos/memory-${number}.jpg`;
  return {
    id: `demo-memory-${number}`,
    source: 'demo',
    title,
    description: descriptions[index] ?? '',
    capturedAt,
    capturedAtMs: new Date(capturedAt).getTime(),
    dateSource: 'manual',
    personIds:
      index % 5 === 0
        ? [people[personIndex].id, people[secondPersonIndex].id]
        : [people[personIndex].id],
    placeId: places[pair % places.length].id,
    mood: moods[index % moods.length],
    tags: [...tagGroups[pair % tagGroups.length], year.toString()],
    dominantColor: {
      rgb,
      hsl: [((index * 31) % 360) / 360, 0.24 + (index % 4) * 0.04, 0.42 + (index % 3) * 0.05],
      luminance: 0.22 + (index % 7) * 0.055,
      algorithmVersion: 1,
    },
    assetKeys: { micro: photoPath, thumbnail: photoPath, preview: photoPath },
    width: index % 3 === 0 ? 1200 : 1600,
    height: index % 3 === 0 ? 1600 : 1067,
    orientationApplied: true,
    createdAt,
    updatedAt: createdAt,
    schemaVersion: 1,
  };
});

const constellations = [
  {
    id: 'demo-constellation-rain',
    source: 'demo',
    name: '雨停以后',
    description: '由雨、回家与城市反光连接起来的六段记忆。',
    memoryIds: memories.slice(0, 6).map((memory) => memory.id),
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: 'demo-constellation-departure',
    source: 'demo',
    name: '出发与告别',
    description: '那些在站台、码头与机场发生的短暂停留。',
    memoryIds: memories.slice(20, 28).map((memory) => memory.id),
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: 'demo-constellation-home',
    source: 'demo',
    name: '回家的路径',
    description: '城市之外，关于旧屋、家人和熟悉气味的记忆。',
    memoryIds: memories.slice(40, 48).map((memory) => memory.id),
    createdAt,
    updatedAt: createdAt,
  },
];

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify({ schemaVersion: 1, memories, people, places, constellations }, null, 2)}\n`,
  'utf8',
);

console.log(`Generated ${memories.length} demo memories at ${outputPath}`);
