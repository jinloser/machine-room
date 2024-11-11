<template>
  <div class="scene-container" ref="sceneContainer"></div>
</template>

<script lang="ts" setup>
import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { onMounted, ref } from 'vue';
import { CSG } from 'three-csg-ts';
import TWEEN from '@tweenjs/tween.js';

const sceneContainer = ref<any>();

const manager = new THREE.LoadingManager();

let camera: any,
  scene: any,
  renderer: any,
  stats: any,
  object: any,
  loader: any,
  matArrayA: any[] = [], //内墙
  matArrayB: any[] = [], //外墙
  group = new THREE.Group();
let mixer: any;

const tweenGroup = new TWEEN.Group();

var door_close = true; //默认是门是关闭的

const initCamera = () => {
  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    1,
    50000
  );
  camera.position.set(0, 2000, 3100);
};

/**加载灯光 */
const initLight = () => {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x225f93);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x000000, 8);
  hemiLight.position.set(0, 200, 0);
  scene.add(hemiLight);
  // scene.add( new THREE.CameraHelper( dirLight.shadow.camera ) );
};

/**创建地面 */
const initFloor = () => {
  const loader = new THREE.TextureLoader();
  loader.load('textures/floor.jpg', function (texture) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 10);
    const floorGeometry = new THREE.BoxGeometry(5000, 5000, 1);
    const floorMaterial = new THREE.MeshBasicMaterial({
      map: texture,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.name = '地面';
    scene.add(floor);
  });
};

//创建墙
const createCubeWall = (
  width: number,
  height: number,
  depth: number,
  angle: number,
  material: any,
  x: number,
  y: number,
  z: number,
  name: string
) => {
  const cubeGeometry = new THREE.BoxGeometry(width, height, depth);
  const cube = new THREE.Mesh(cubeGeometry, material);
  cube.position.x = x;
  cube.position.y = y;
  cube.position.z = z;
  cube.rotation.y += angle * Math.PI; //-逆时针旋转,+顺时针
  cube.name = name;
  scene.add(cube);
};

const createWallOthers = (
  width: number,
  height: number,
  depth: number,
  angle: number,
  material: string,
  x: number,
  y: number,
  z: number,
  name: string,
  translateX: number
) => {
  var loader = new THREE.TextureLoader();
  loader.load(`textures/${material}`, function (texture) {
    var doorgeometry = new THREE.BoxGeometry(width, height, depth);
    doorgeometry.translate(translateX, 0, 0);
    var doormaterial = new THREE.MeshBasicMaterial({
      map: texture,
      color: 0xffffff,
    });
    doormaterial.opacity = 1.0;
    doormaterial.transparent = true;
    var door = new THREE.Mesh(doorgeometry, doormaterial);
    door.position.set(x, y, z);
    door.rotation.y += angle * Math.PI; //-逆时针旋转,+顺时针
    door.name = name;
    scene.add(door);
  });
};

//返回墙对象
const returnWallObject = (
  width: number,
  height: number,
  depth: number,
  angle: number,
  material: any,
  x: number,
  y: number,
  z: number,
  name: string
) => {
  var cubeGeometry = new THREE.BoxGeometry(width, height, depth);
  var cube = new THREE.Mesh(cubeGeometry, material);
  cube.position.x = x;
  cube.position.y = y;
  cube.position.z = z;
  cube.rotation.y += angle * Math.PI;
  cube.name = name;
  return cube;
};

//墙上挖门，通过两个几何体生成BSP对象
const createResultBsp = (bsp: THREE.Mesh, objects_cube: THREE.Mesh[]) => {
  var material = new THREE.MeshPhongMaterial({
    color: 0x9cb2d1,
    specular: 0x9cb2d1,
    shininess: 30,
    transparent: true,
    opacity: 1,
    flatShading: true,
  });

  // 将初始几何体转换为 CSG
  var BSP = CSG.fromMesh(bsp);

  // 对每个 objects_cube 进行布尔运算
  for (var i = 0; i < objects_cube.length; i++) {
    var less_bsp = CSG.fromMesh(objects_cube[i]);
    BSP = BSP.subtract(less_bsp);
  }

  // 将结果转换回 Mesh
  var result = CSG.toMesh(BSP, bsp.matrix, material);

  // 更新法线和几何体
  result.geometry.computeVertexNormals();
  result.position.x = 0;
  result.position.y = 150;
  result.position.z = 1000;

  scene.add(result);
};

//创建墙纹理
const createWallMaterail = () => {
  matArrayA.push(new THREE.MeshPhongMaterial({ color: 0xafc0ca })); //前  0xafc0ca :灰色
  matArrayA.push(new THREE.MeshPhongMaterial({ color: 0xafc0ca })); //后
  matArrayA.push(new THREE.MeshPhongMaterial({ color: 0xd6e4ec })); //上  0xd6e4ec： 偏白色
  matArrayA.push(new THREE.MeshPhongMaterial({ color: 0xd6e4ec })); //下
  matArrayA.push(new THREE.MeshPhongMaterial({ color: 0xafc0ca })); //左    0xafc0ca :灰色
  matArrayA.push(new THREE.MeshPhongMaterial({ color: 0xafc0ca })); //右

  matArrayB.push(new THREE.MeshPhongMaterial({ color: 0xafc0ca })); //前  0xafc0ca :灰色
  matArrayB.push(new THREE.MeshPhongMaterial({ color: 0x9cb2d1 })); //后  0x9cb2d1：淡紫
  matArrayB.push(new THREE.MeshPhongMaterial({ color: 0xd6e4ec })); //上  0xd6e4ec： 偏白色
  matArrayB.push(new THREE.MeshPhongMaterial({ color: 0xd6e4ec })); //下
  matArrayB.push(new THREE.MeshPhongMaterial({ color: 0xafc0ca })); //左   0xafc0ca :灰色
  matArrayB.push(new THREE.MeshPhongMaterial({ color: 0xafc0ca })); //右
};

const loadAsset = (
  asset: string,
  position: GenericityObj = {},
  name: string
) => {
  loader.load('model/' + asset + '.FBX', (model: GenericityObj) => {
    model.position.set(position.x, position.y, position.z);
    model.traverse((child: GenericityObj) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.name = name;
      }
    });
    scene.add(model);
  });
};

const onWindowResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};

const moveDoor = (object: GenericityObj, distance: number) => {
  new TWEEN.Tween(object.position, tweenGroup)
    .to(
      {
        x: distance,
      },
      2000
    )
    .easing()
    .onComplete(function () {})
    .start();
};

const onMouseClick = (event: any) => {
  var raycaster = new THREE.Raycaster();
  var mouse = new THREE.Vector2();
  var x, y;
  if (event.changedTouches) {
    x = event.changedTouches[0].pageX;
    y = event.changedTouches[0].pageY;
  } else {
    x = event.clientX;
    y = event.clientY;
  }
  mouse.x = (x / window.innerWidth) * 2 - 1;
  mouse.y = -(y / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  var intersects = raycaster.intersectObjects([scene], true);
  if (intersects.length == 0) return;
  const clickObj = intersects[0].object;
  const objectName = clickObj.name;
  console.log(objectName);
  if (objectName == '门禁') {
    const leftDoor = scene.getObjectByName('左门');
    const rightDoor = scene.getObjectByName('右门');
    if (door_close) {
      moveDoor(leftDoor, -275);
      moveDoor(rightDoor, 275);
      door_close = false;
    } else {
      moveDoor(leftDoor, -125);
      moveDoor(rightDoor, 125);
      door_close = true;
    }
  } else if (objectName.includes('电池门')) {
    const v = objectName.split('~');
    new TWEEN.Tween(intersects[0].object.rotation, tweenGroup)
      .to(
        {
          z: v[1] === 'close' ? 90 * (Math.PI / 180) : 0,
        },
        500
      )
      .easing()
      .onComplete(function () {})
      .start();
    clickObj.name = v[1] === 'close' ? `${v[0]}~open` : `${v[0]}~close`;
  } else if (objectName.includes('单体电池')) {
    const v = objectName.split('~');
    new TWEEN.Tween(intersects[0].object.position, tweenGroup)
      .to(
        {
          z:
            v[1] === 'inside'
              ? intersects[0].object.position.z + 50
              : intersects[0].object.position.z - 50,
        },
        500
      )
      .easing()
      .onComplete(function () {})
      .start();
    clickObj.name = v[1] === 'inside' ? `${v[0]}~outside` : `${v[0]}~inside`;
  }
};

const onMouseDblClick = (event: any) => {
  var raycaster = new THREE.Raycaster();
  var mouse = new THREE.Vector2();
  var x, y;
  if (event.changedTouches) {
    x = event.changedTouches[0].pageX;
    y = event.changedTouches[0].pageY;
  } else {
    x = event.clientX;
    y = event.clientY;
  }
  mouse.x = (x / window.innerWidth) * 2 - 1;
  mouse.y = -(y / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  var intersects = raycaster.intersectObjects([scene], true);
  if (intersects.length == 0) return;
  const clickObj = intersects[0].object;
  const objectName = clickObj.name;
  console.log(objectName);
  if (objectName.includes('电池柜')) {
    moveCameraToObject(clickObj);
  }
};

const moveCameraToObject = (object: GenericityObj) => {
  // 目标位置设置为模型的世界坐标
  const targetPosition = new THREE.Vector3();
  object.getWorldPosition(targetPosition);

  // 创建一个新的 TWEEN 动画，将相机平滑移动到目标模型的后方
  new TWEEN.Tween(camera.position, tweenGroup)
    .to(
      {
        x: targetPosition.x, // 根据需要调整相机相对模型的位置
        y: targetPosition.y + 500,
        z: targetPosition.z + 500,
      },
      1000 // 动画持续时间，1秒
    )
    .easing(TWEEN.Easing.Quadratic.InOut)
    .onUpdate(() => {
      camera.lookAt(targetPosition); // 相机始终朝向目标模型
    })
    .start();
};

const animate = (time: number) => {
  stats.update();
  tweenGroup.update(time);
  renderer.render(scene, camera);
};

/**
 * 生成电源系统、控制面板、电池柜及电池方法
 * 每个电池柜有4层，每层前后排各4个电池。即每个电池柜可容纳 32 个电池。
 * 电池柜的数量根据实际电池数量计算 cabinetNum = Math.ceil(batteryNum / batteriesPerCabinet);
 * @param batteryNum 需要生成的电池数量
 */
const initBattery = (batteryNum: number) => {
  const batteriesPerCabinet = 32; // 每个电池柜 32 个电池
  const rowNum = 16; // 每行有几个电池柜
  const cabinetWidth = 80; // 每个电池柜的宽度（横向间隔）
  const cabinetDepth = 400; // 每个电池柜的纵向间隔
  const layerHeight = 48; // 每层的高度
  const frontOffset = 25; // 前排电池的偏移
  const backOffset = -25; // 后排电池的偏移
  let batteryCounter = 1; // 全局电池计数器

  const cabinetNum = Math.ceil(batteryNum / batteriesPerCabinet); // 计算需要的电池柜数量
  console.log(`电池柜数量: ${cabinetNum}`);

  // 生成电源系统和控制面板的资产
  loadAsset(
    'DYXT',
    {
      x:
        1 * cabinetWidth -
        (10 - (cabinetNum > rowNum ? rowNum : cabinetNum)) * cabinetWidth,
      y: 0,
      z: 0,
    },
    '电源系统'
  );
  loadAsset(
    'XDCAQYWZNGLXT',
    {
      x:
        2 * cabinetWidth -
        (10 - (cabinetNum > rowNum ? rowNum : cabinetNum)) * cabinetWidth,
      y: 116,
      z: 0,
    },
    'NRDA-300'
  );

  for (let cabinetIndex = 1; cabinetIndex <= cabinetNum; cabinetIndex++) {
    // 计算电池柜的行和列
    const rowIndex = Math.ceil(cabinetIndex / rowNum); // 当前柜子在哪一行
    const colIndex =
      cabinetIndex % rowNum === 0 ? rowNum : cabinetIndex % rowNum; // 当前柜子在当前行的哪一列

    // 添加电池柜和电池门
    loadAsset(
      'DCG_gui',
      {
        x: (colIndex - 10) * cabinetWidth,
        y: 0,
        z: -(rowIndex - 1) * cabinetDepth,
      },
      `电池柜${cabinetIndex}`
    );
    loadAsset(
      'DCG_men',
      {
        x: (colIndex - 10) * cabinetWidth,
        y: 0,
        z: -(rowIndex - 1) * cabinetDepth,
      },
      `电池门${cabinetIndex}~close`
    );

    // 每个电池柜有4层，每层前后排各4个电池
    for (let layer = 0; layer < 4; layer++) {
      // 前排的电池
      for (let posInFront = 0; posInFront < 4; posInFront++) {
        if (batteryCounter > batteryNum) break; // 超过电池总数则停止
        const xPos = (colIndex - 10) * cabinetWidth - 30 + posInFront * 20; // 水平方向
        const yPos = layer * layerHeight + 20; // 垂直方向
        const zPos = -(rowIndex - 1) * cabinetDepth + frontOffset; // 前排纵深位置

        loadAsset(
          'Dianchi',
          { x: xPos, y: yPos, z: zPos },
          `单体电池${batteryCounter}~inside`
        );
        batteryCounter++;
      }

      // 后排的电池
      for (let posInBack = 0; posInBack < 4; posInBack++) {
        if (batteryCounter > batteryNum) break; // 超过电池总数则停止
        const xPos = (colIndex - 10) * cabinetWidth - 30 + posInBack * 20; // 水平方向
        const yPos = layer * layerHeight + 20; // 垂直方向
        const zPos = -(rowIndex - 1) * cabinetDepth + backOffset; // 后排纵深位置

        loadAsset(
          'Dianchi',
          { x: xPos, y: yPos, z: zPos },
          `单体电池${batteryCounter}~inside`
        );
        batteryCounter++;
      }
    }
  }
};

const initScene = () => {
  initCamera();
  initLight();
  initFloor();
  createWallMaterail();
  createCubeWall(10, 300, 2000, 0, matArrayB, -1000, 150, 0, '墙面');
  createCubeWall(10, 300, 2000, 1, matArrayB, 1000, 150, 0, '墙面');
  createCubeWall(10, 300, 2000, 1.5, matArrayB, 0, 150, -1000, '墙面');
  // createCubeWall(10, 300, 2000, 1.5, matArrayB, 0, 150, 1000, '墙面');
  //创建挖了门的墙
  var wall = returnWallObject(
    2000,
    300,
    10,
    1.5,
    matArrayB,
    0,
    -150,
    -1000,
    '墙面'
  );
  var door_cube = returnWallObject(
    300,
    280,
    10,
    0,
    matArrayB,
    -800,
    -90,
    -700,
    '门洞'
  );
  var objects_cube = [];
  objects_cube.push(door_cube);
  createResultBsp(wall, objects_cube);
  //为墙面安装门
  createWallOthers(
    150,
    280,
    5,
    0,
    'door_left.png',
    -125,
    150,
    1000,
    '左门',
    50
  );
  createWallOthers(
    150,
    280,
    5,
    0,
    'door_right.png',
    125,
    150,
    1000,
    '右门',
    -50
  );
  createWallOthers(
    40,
    60,
    10,
    0,
    'doorControl.png',
    -205,
    180,
    1010,
    '门禁',
    0
  );
  createWallOthers(
    80,
    220,
    60,
    -90 * Math.PI,
    'aircondition.jpg',
    -920,
    100,
    -920,
    '空调',
    0
  );
  createWallOthers(
    100,
    200,
    2,
    -180 * Math.PI,
    'message.jpg',
    -990,
    150,
    -700,
    '背景墙',
    0
  );

  loader = new FBXLoader(manager);

  initBattery(240);
  initRanderer();
  initControls();

  window.addEventListener('resize', onWindowResize);
  window.addEventListener('click', onMouseClick);
  window.addEventListener('dblclick', onMouseDblClick);
  initStat();
};

const initRanderer = () => {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 可选的阴影类型
  sceneContainer.value.appendChild(renderer.domElement);
};

const initControls = () => {
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 100, 0);
  controls.update();
};

const initStat = () => {
  stats = new Stats();
  sceneContainer.value.appendChild(stats.dom);
};

onMounted(() => initScene());
</script>

<style scoped>
.scene-container {
  width: 100%;
  height: 100vh;
  display: block;
}
</style>
