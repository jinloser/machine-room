<template>
  <div class="scene-container" ref="sceneContainer"></div>
  <div class="search">
    <el-input v-model="batteryNum" />
    <el-button type="primary" @click="setBatteryNum">确定</el-button>
  </div>
</template>

<script lang="ts" setup>
import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { createApp, h, onMounted, onUnmounted, ref } from 'vue';
import TWEEN from '@tweenjs/tween.js';
import TooltipContent from './views/tooltipContent.vue';
import {
  CSS2DRenderer,
  CSS2DObject,
} from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { loadPlugins } from './plugins';
import { ElMessage } from 'element-plus';
import { CSG } from 'three-csg-ts';

const batteryNum = ref(2000);
const sceneContainer = ref<any>();
const labelRenderer = new CSS2DRenderer();
const manager = new THREE.LoadingManager();

let camera: any,
  scene: any,
  renderer: any,
  stats: any,
  controls: any,
  batteryPop: any,
  ledScreenPop: any,
  openedDoorInstanceId: number, //当前打开的电池柜实例id
  outsideBatteryInstanceId: number, //当前移出的电池实例id
  matArrayA: any[] = [], //内墙
  matArrayB: any[] = [], //外墙
  door_close = true; //默认是门是关闭的

let cabinetInstances: any; //电池柜实例化网格
let doorInstances: any; //电池门实例化网格
let batteryInstances: any; //电池实例化网格

const tweenGroup = new TWEEN.Group();
const loader = new FBXLoader(manager);

// 创建一个 Map 来存储 instanceId 和 name 的映射
let cabinetNameMap: any = new Map();
let doorNameMap: any = new Map();
let batteryNameMap: any = new Map();

const setBatteryNum = () => {
  if (!batteryNum.value) {
    ElMessage.error('请输入正确的电池数量');
    return;
  }
  disposeEngine();
  initScene();
};

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
  scene.background = new THREE.Color(0x98a7ad);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x000000, 8);
  hemiLight.position.set(0, 200, 0);
  scene.add(hemiLight);
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
  name: string,
  modelLoadCallback?: Function
) => {
  loader.load('model/' + asset + '.FBX', (model: any) => {
    model.position.set(position.x, position.y, position.z);
    model.traverse((child: GenericityObj) => {
      if (child.isMesh) {
        child.name = name;
      }
    });
    scene.add(model);
    modelLoadCallback && modelLoadCallback(model);
  });
};

const onWindowResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};

/**
 * 将移出来的电池移回原位并消除气泡
 */
const closeOutsideBattery = () => {
  if (outsideBatteryInstanceId) {
    const batteryName = batteryNameMap.get(outsideBatteryInstanceId);
    const battery = new THREE.Object3D();
    batteryInstances.getMatrixAt(outsideBatteryInstanceId, battery.matrix);
    battery.matrix.decompose(
      battery.position,
      battery.quaternion,
      battery.scale
    );
    const v = batteryName.split('~');
    new TWEEN.Tween(battery.position, tweenGroup)
      .to(
        {
          z: battery.position.z - (batteryName.includes('front') ? 50 : 100),
        },
        500
      )
      .easing()
      .onUpdate(() => {
        // 更新每一帧动画时，重新计算矩阵
        battery.updateMatrix();
        batteryInstances.setMatrixAt(outsideBatteryInstanceId, battery.matrix); // 将新的矩阵更新回 InstancedMesh
        batteryInstances.instanceMatrix.needsUpdate = true; // 通知实例矩阵需要更新
      })
      .onComplete(function () {
        outsideBatteryInstanceId = 0;
      })
      .start();
    batteryNameMap.set(outsideBatteryInstanceId, `${v[0]}~inside`);
    scene.remove(batteryPop);
    batteryPop.element.remove();
    batteryPop = null;
  }
};

/**
 * 将打开的电池门关闭
 */
const closeOPenedDoor = () => {
  if (openedDoorInstanceId) {
    const doorName = doorNameMap.get(openedDoorInstanceId);
    if (doorName) {
      closeOutsideBattery();
      const dummy = new THREE.Object3D();
      doorInstances.getMatrixAt(openedDoorInstanceId, dummy.matrix);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
      const n = doorName.split('~');
      new TWEEN.Tween(dummy.rotation, tweenGroup)
        .to(
          {
            z: 0,
          },
          500
        )
        .easing()
        .onUpdate(() => {
          // 更新每一帧动画时，重新计算矩阵
          dummy.updateMatrix();
          doorInstances.setMatrixAt(openedDoorInstanceId, dummy.matrix); // 将新的矩阵更新回 InstancedMesh
          doorInstances.instanceMatrix.needsUpdate = true; // 通知实例矩阵需要更新
        })
        .onComplete(function () {
          openedDoorInstanceId = 0;
        })
        .start();
      doorNameMap.set(openedDoorInstanceId, `${n[0]}~close`);
    }
  }
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

const onMouseDblClick = (event: any) => {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let x, y;
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
  const intersects = raycaster.intersectObjects([scene], true);
  if (intersects.length == 0) return;
  const clickObj = intersects[0].object;
  const objectName = clickObj.name;
  console.log(clickObj);
  if (objectName.includes('电源系统') || objectName.includes('NRDA-300')) {
    moveCameraToObject(clickObj);
  } else if (objectName == '门禁') {
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
  } else {
    const instanceId = intersects[0].instanceId;
    if (instanceId && objectName) {
      console.log(objectName, instanceId);
      if (objectName === 'Dianchi') {
        clickToBattery(instanceId);
      } else if (objectName === 'DCG_gui') {
        const cabinetName = cabinetNameMap.get(instanceId);
        if (cabinetName) {
          const dummy = new THREE.Object3D();
          cabinetInstances.getMatrixAt(instanceId, dummy.matrix);
          dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
          moveCameraToObject(dummy);
        }
      } else if (objectName === 'DCG_men') {
        clickToDoor(instanceId);
      }
    }
  }
};

const clickToBattery = (instanceId: number) => {
  const batteryName = batteryNameMap.get(instanceId); // 通过 instanceId 获取 name
  console.log(`被点击的电池名称: ${batteryName}`);
  if (batteryName) {
    closeOutsideBattery();
    const dummy = new THREE.Object3D();
    batteryInstances.getMatrixAt(instanceId, dummy.matrix);
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
    const v = batteryName.split('~');
    new TWEEN.Tween(dummy.position, tweenGroup)
      .to(
        {
          z:
            v[1] === 'inside'
              ? dummy.position.z + (batteryName.includes('front') ? 50 : 100)
              : dummy.position.z - (batteryName.includes('front') ? 50 : 100),
        },
        500
      )
      .easing()
      .onUpdate(() => {
        // 更新每一帧动画时，重新计算矩阵
        dummy.updateMatrix();
        batteryInstances.setMatrixAt(instanceId, dummy.matrix); // 将新的矩阵更新回 InstancedMesh
        batteryInstances.instanceMatrix.needsUpdate = true; // 通知实例矩阵需要更新
      })
      .onComplete(function () {
        if (v[1] === 'inside') {
          moveCameraToObject(dummy, { x: 0, y: 150, z: 250 }, () =>
            createBatteryPop(dummy)
          );
          outsideBatteryInstanceId = instanceId;
        }
      })
      .start();
    // 更新 instanceNames 中的 name
    batteryNameMap.set(
      instanceId,
      v[1] === 'inside' ? `${v[0]}~outside` : `${v[0]}~inside`
    );
  }
};

const clickToDoor = (instanceId: number) => {
  const doorName = doorNameMap.get(instanceId); // 通过 instanceId 获取 name
  console.log(`被点击的电池柜名称: ${doorName}`);
  if (doorName) {
    closeOPenedDoor();
    const dummy = new THREE.Object3D();
    doorInstances.getMatrixAt(instanceId, dummy.matrix);
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
    const v = doorName.split('~');
    new TWEEN.Tween(dummy.rotation, tweenGroup)
      .to(
        {
          z: v[1] === 'close' ? -90 * (Math.PI / 180) : 0,
        },
        500
      )
      .easing()
      .onUpdate(() => {
        // 更新每一帧动画时，重新计算矩阵
        dummy.updateMatrix();
        doorInstances.setMatrixAt(instanceId, dummy.matrix); // 将新的矩阵更新回 InstancedMesh
        doorInstances.instanceMatrix.needsUpdate = true; // 通知实例矩阵需要更新
      })
      .onComplete(function () {
        if (v[1] === 'close') {
          openedDoorInstanceId = instanceId;
        }
      })
      .start();
    doorNameMap.set(
      instanceId,
      v[1] === 'close' ? `${v[0]}~open` : `${v[0]}~close`
    );
  }
};

const onMouseMove = (event: any) => {
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
  if (objectName === 'led-screen') {
    if (!ledScreenPop) createLedScreenPop(clickObj);
  } else {
    if (ledScreenPop) {
      const ledScreen = scene.getObjectByName('led-screen');
      ledScreen!.remove(ledScreenPop);
      ledScreenPop.element.remove();
      ledScreenPop = null;
    }
  }
};

const moveCameraToObject = (
  object: GenericityObj,
  offset: GenericityObj = {},
  moveToCallBack?: Function
) => {
  // 目标位置设置为模型的世界坐标
  const targetPosition = new THREE.Vector3();
  object.getWorldPosition(targetPosition);
  const { x = 0, y = 500, z = 500 } = offset;

  // 创建一个新的 TWEEN 动画，将相机平滑移动到目标模型的后方
  new TWEEN.Tween(camera.position, tweenGroup)
    .to(
      {
        x: targetPosition.x + x, // 根据需要调整相机相对模型的位置
        y: targetPosition.y + y,
        z: targetPosition.z + z,
      },
      1000 // 动画持续时间，1秒
    )
    .easing(TWEEN.Easing.Quadratic.InOut)
    .onUpdate(() => {
      camera.lookAt(targetPosition); // 相机始终朝向目标模型
      controls.target.copy(targetPosition);
      controls.update();
    })
    .onComplete(function () {
      moveToCallBack && moveToCallBack();
    })
    .start();
};

const animate = (time: number) => {
  stats.update();
  tweenGroup.update(time);
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
};

/**
 * 生成电源系统、控制面板、电池柜及电池方法
 * 每个电池柜有4层，每层前后排各4个电池。即每个电池柜可容纳 32 个电池。
 * 电池柜的数量根据实际电池数量计算 cabinetNum = Math.ceil(batteryNum / batteriesPerCabinet);
 * @param batteryNum 需要生成的电池数量
 */
const initBattery = async (batteryNum: number) => {
  const batteriesPerCabinet = 32; // 每个电池柜 32 个电池
  const rowNum = 16; // 每行有几个电池柜
  const cabinetWidth = 80; // 每个电池柜的宽度（横向间隔）
  const cabinetNum = Math.ceil(batteryNum / batteriesPerCabinet); // 需要创建的电池柜数量
  console.log(`电池柜数量: ${cabinetNum}`);
  const realRowNum = cabinetNum > rowNum ? rowNum : cabinetNum; //一行最多16个
  const offsetX = (10 - realRowNum) * 70 + realRowNum * 25; //根据电池柜数量计算偏移

  createPowerControlModel(cabinetWidth, cabinetNum, rowNum, offsetX); // 创建电源系统和控制面板的资产
  createBatteryModels(batteryNum, cabinetWidth, cabinetNum, rowNum, offsetX); // 创建电池柜、电池门及单体电池
};

/**
 * 创建电源系统和控制面板的资产
 * @param cabinetWidth 每个电池柜的宽度（横向间隔）
 * @param cabinetNum 需要创建的电池柜数量
 * @param rowNum 每行有几个电池柜
 * @param offsetX 根据电池柜数量计算偏移量
 */
const createPowerControlModel = (
  cabinetWidth: number,
  cabinetNum: number,
  rowNum: number,
  offsetX: number
) => {
  loadAsset(
    'DYXT',
    {
      x:
        1 * cabinetWidth -
        (10 - (cabinetNum > rowNum ? rowNum : cabinetNum)) * cabinetWidth +
        offsetX,
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
        (10 - (cabinetNum > rowNum ? rowNum : cabinetNum)) * cabinetWidth +
        offsetX,
      y: 116,
      z: 0,
    },
    'NRDA-300',
    (model: any) => {
      createPolygon(model);
    }
  );
};

/**
 * 创建电池柜、电池门及单体电池
 * 每个电池柜有4层，每层前后排各4个电池。即每个电池柜可容纳 32 个电池。
 * 电池柜的数量根据实际电池数量计算 cabinetNum = Math.ceil(batteryNum / batteriesPerCabinet);
 * @param batteryNum 需要创建的电池数量
 * @param cabinetWidth 每个电池柜的宽度（横向间隔）
 * @param cabinetNum 需要创建的电池柜数量
 * @param rowNum 每行有几个电池柜
 * @param offsetX 根据电池柜数量计算偏移量
 */
const createBatteryModels = async (
  batteryNum: number,
  cabinetWidth: number,
  cabinetNum: number,
  rowNum: number,
  offsetX: number
) => {
  const cabinetDepth = 250; // 每个电池柜的纵向间隔
  const layerHeight = 48; // 每层的高度
  const frontOffset = 25; // 前排电池的偏移
  const backOffset = -25; // 后排电池的偏移
  let batteryCounter = 1; // 全局电池计数器

  // 创建电池柜实例化网格
  const { modelInstances: cabinet, dummy: cabinetDummy }: any =
    await createInstancedMesh('DCG_gui', cabinetNum);
  cabinetInstances = cabinet;

  // 创建电池门实例化网格
  const { modelInstances: door, dummy: doorDummy }: any =
    await createInstancedMesh('DCG_men', cabinetNum);
  doorInstances = door;

  // 创建电池实例化网格
  const { modelInstances: battery, dummy: batteryDummy }: any =
    await createInstancedMesh('Dianchi', batteryNum);
  batteryInstances = battery;

  for (let cabinetIndex = 1; cabinetIndex <= cabinetNum; cabinetIndex++) {
    // 计算电池柜的行和列
    const rowIndex = Math.ceil(cabinetIndex / rowNum); // 当前柜子在哪一行
    const colIndex =
      cabinetIndex % rowNum === 0 ? rowNum : cabinetIndex % rowNum; // 当前柜子在当前行的哪一列

    // 添加电池柜
    cabinetDummy.position.set(
      (colIndex - 10) * cabinetWidth + offsetX,
      0,
      -(rowIndex - 1) * cabinetDepth
    );
    cabinetDummy.updateMatrix();
    cabinetInstances.setMatrixAt(cabinetIndex, cabinetDummy.matrix); // 设置实例变换矩阵
    cabinetNameMap.set(cabinetIndex, `电池柜${cabinetIndex}`); // 保存 name 和 instanceId 的映射

    // 添加电池门
    doorDummy.position.set(
      (colIndex - 10) * cabinetWidth + offsetX - 40,
      6,
      -(rowIndex - 1) * cabinetDepth + 48
    );
    doorDummy.updateMatrix();
    doorInstances.setMatrixAt(cabinetIndex, doorDummy.matrix); // 设置实例变换矩阵
    doorNameMap.set(cabinetIndex, `电池门${cabinetIndex}~close`); // 保存 name 和 instanceId 的映射

    // 每个电池柜有4层，每层前后排各4个电池
    for (let layer = 0; layer < 4; layer++) {
      // 前排的电池
      for (let posInFront = 0; posInFront < 4; posInFront++) {
        if (batteryCounter > batteryNum) break; // 超过电池总数则停止
        const xPos = (colIndex - 10) * cabinetWidth - 30 + posInFront * 20; // 水平方向
        const yPos = layer * layerHeight + 20; // 垂直方向
        const zPos = -(rowIndex - 1) * cabinetDepth + frontOffset; // 前排纵深位置

        batteryDummy.position.set(xPos + offsetX, yPos, zPos);
        batteryDummy.updateMatrix();
        batteryInstances.setMatrixAt(batteryCounter, batteryDummy.matrix); // 设置实例变换矩阵
        // 为每个电池实例设置一个唯一的名字并存储在 Map 中
        const batteryName = `单体电池-${batteryCounter}-front~inside`;
        batteryNameMap.set(batteryCounter, batteryName); // 保存 name 和 instanceId 的映射
        batteryCounter++;
      }

      // 后排的电池
      for (let posInBack = 0; posInBack < 4; posInBack++) {
        if (batteryCounter > batteryNum) break; // 超过电池总数则停止
        const xPos = (colIndex - 10) * cabinetWidth - 30 + posInBack * 20; // 水平方向
        const yPos = layer * layerHeight + 20; // 垂直方向
        const zPos = -(rowIndex - 1) * cabinetDepth + backOffset; // 后排纵深位置

        batteryDummy.position.set(xPos + offsetX, yPos, zPos);
        batteryDummy.updateMatrix();
        batteryInstances.setMatrixAt(batteryCounter, batteryDummy.matrix); // 设置实例变换矩阵
        const batteryName = `单体电池-${batteryCounter}-back~inside`;
        batteryNameMap.set(batteryCounter, batteryName); // 保存 name 和 instanceId 的映射
        batteryCounter++;
      }
    }
    // 添加到场景中
    scene.add(cabinetInstances);
    scene.add(doorInstances);
    scene.add(batteryInstances);
  }
};

/**
 * 加载FBX模型并创建实例化网格
 * @param asset 模型路径
 * @param batteryNum 电池数量
 */
const createInstancedMesh = (asset: string, batteryNum: number) => {
  return new Promise((resolve, reject) => {
    loader.load(
      `./model/${asset}.FBX`,
      (object: any) => {
        const { geometry, material } = object.children[0]; // 获取模型的几何体、材质、原始角度及原始缩放
        const modelInstances = new THREE.InstancedMesh(
          geometry,
          material,
          batteryNum + 1
        );
        const dummy = new THREE.Object3D(); // 用于设置每个实例的变换矩阵
        dummy.scale.set(100, 100, 100); //模型的原始缩放比例
        dummy.rotation.set(-1.57, 0, 0); // 模型的原始角度
        modelInstances.name = asset;
        resolve({
          modelInstances,
          dummy,
        });
      },
      undefined,
      reject
    );
  });
};

/**创建电池弹窗气泡 */
const createBatteryPop = (model: any) => {
  const batteryName = batteryNameMap.get(outsideBatteryInstanceId);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0px';
  labelRenderer.domElement.style.pointerEvents = 'none'; // 允许事件穿透
  document.body.appendChild(labelRenderer.domElement);
  const div = document.createElement('div');
  const app = createApp({
    render() {
      return h(TooltipContent, {
        isBattery: true,
        batteryName: batteryName?.split('-')[1] || 'led显示屏',
      });
    },
  });
  loadPlugins(app);
  app.mount(div);
  // 创建 CSS2DObject
  batteryPop = new CSS2DObject(div);
  batteryPop.position.set(model.position.x, model.position.y, model.position.z);
  scene.add(batteryPop);
};

/**创建led屏幕气泡 */
const createLedScreenPop = (model: any) => {
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0px';
  labelRenderer.domElement.style.pointerEvents = 'none'; // 允许事件穿透
  document.body.appendChild(labelRenderer.domElement);
  const div = document.createElement('div');
  const app = createApp({
    render() {
      return h(TooltipContent, {
        isBattery: false,
        batteryName: 'led显示屏',
      });
    },
  });
  loadPlugins(app);
  app.mount(div);
  // 创建 CSS2DObject
  ledScreenPop = new CSS2DObject(div);
  ledScreenPop.position.set(0, 0, 0);
  model.add(ledScreenPop);
};

/**创建主机屏幕面以供交互 */
const createPolygon = (model: any) => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d') as any; // 获取2D上下文
  canvas.width = 100; // 设置 Canvas 宽度
  canvas.height = 50; // 设置 Canvas 高度

  // 清空背景，确保透明
  context.clearRect(0, 0, canvas.width, canvas.height);

  // 将Canvas转换为纹理
  const texture = new THREE.CanvasTexture(canvas);

  // 创建材质和几何体
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
  });
  const geometry = new THREE.PlaneGeometry(50, 20);

  // 创建平面
  const plane = new THREE.Mesh(geometry, material);
  const { x, y, z } = model.position;
  // 设置平面位置
  plane.position.set(x, y + 50, z + 51);
  plane.name = 'led-screen';

  // 将平面添加到场景中
  scene.add(plane);
};

const initScene = async () => {
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

  await initBattery(batteryNum.value);
  initRanderer();
  initControls();

  window.addEventListener('resize', onWindowResize);
  window.addEventListener('dblclick', onMouseDblClick);
  window.addEventListener('mousemove', onMouseMove);
  initStat();
};

const initRanderer = () => {
  renderer = new THREE.WebGLRenderer({});
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 可选的阴影类型
  sceneContainer.value.appendChild(renderer.domElement);
};

const initControls = () => {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 100, 0);
  // 限制相机的缩放距离
  controls.minDistance = 50;
  controls.maxDistance = 3000;
  controls.update();
};

const initStat = () => {
  stats = new Stats();
  sceneContainer.value.appendChild(stats.dom);
};

const disposeInstances = (modelInstances: any) => {
  if (modelInstances) {
    if (modelInstances.geometry) {
      modelInstances.geometry.dispose(); // 释放几何体资源
    }

    if (modelInstances.material) {
      if (Array.isArray(modelInstances.material)) {
        modelInstances.material.forEach((material: any) => {
          if (material.map) material.map.dispose(); // 释放纹理
          material.dispose(); // 释放材质
        });
      } else {
        // 销毁单一材质
        if (modelInstances.material.map) {
          modelInstances.material.map.dispose(); // 释放纹理
        }
        modelInstances.material.dispose(); // 释放材质
      }
    }
    scene.remove(modelInstances);
  }
};

const disposeScene = () => {
  scene.traverse((child: any) => {
    if (child.geometry) {
      child.geometry.dispose();
    }
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((material: any) => material.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
  scene.clear();
};

const disposeEngine = () => {
  renderer.setAnimationLoop(null); // 停止循环
  renderer.dispose();

  disposeInstances(cabinetInstances);
  cabinetInstances = null;
  cabinetNameMap.clear();

  disposeInstances(doorInstances);
  doorInstances = null;
  doorNameMap.clear();

  disposeInstances(batteryInstances);
  batteryInstances = null;
  batteryNameMap.clear();

  disposeScene();

  // 销毁控制器
  controls.dispose();

  // 移除事件监听器
  window.removeEventListener('resize', onWindowResize);
  window.removeEventListener('dblclick', onMouseDblClick);
  window.removeEventListener('mousemove', onMouseMove);

  // 移除渲染器的 DOM 元素
  renderer.domElement.remove();

  stats.dom?.remove();
  stats = null;
  batteryPop = null;
  ledScreenPop = null;
  openedDoorInstanceId = 0;
  outsideBatteryInstanceId = 0;

  // 清理全局变量
  scene = null;
  camera = null;
  renderer = null;
  controls = null;
};

onUnmounted(() => disposeEngine());
onMounted(() => initScene());
</script>

<style scoped>
.scene-container {
  width: 100%;
  height: 100vh;
  display: block;
}
.search {
  display: flex;
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 9999;
}
</style>
