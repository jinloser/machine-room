<template>
  <div class="scene-container" ref="sceneContainer"></div>
</template>

<script lang="ts" setup>
import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { createApp, h, onMounted, ref } from 'vue';
import TWEEN from '@tweenjs/tween.js';
import TooltipContent from './views/tooltipContent.vue';
import {
  CSS2DRenderer,
  CSS2DObject,
} from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { loadPlugins } from './plugins';

const sceneContainer = ref<any>();
const labelRenderer = new CSS2DRenderer();
const manager = new THREE.LoadingManager();

let camera: any,
  scene: any,
  renderer: any,
  stats: any,
  loader: any,
  controls: any,
  batteryPop: any,
  ledScreenPop: any,
  openedDoorName: string, //当前打开的电池柜名称
  outsideBatteryName: any; //当前显示的电池名称

const tweenGroup = new TWEEN.Group();

const initCamera = () => {
  // 创建透视相机
  camera = new THREE.PerspectiveCamera(
    45, // 视场角
    window.innerWidth / window.innerHeight, // 宽高比
    1, // 近裁剪面
    10000 // 远裁剪面
  );

  // 设置相机位置，向右移动100单位
  camera.position.set(0, 1000, 1000);
};

/**加载灯光 */
const initLight = () => {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x98a7ad);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x000000, 8);
  hemiLight.position.set(0, 200, 0);
  scene.add(hemiLight);
  // scene.add( new THREE.CameraHelper( dirLight.shadow.camera ) );
};

const loadAsset = (
  asset: string,
  position: GenericityObj = {},
  name: string,
  modelLoadCallback?: Function
) => {
  loader.load('model/' + asset + '.FBX', (model: GenericityObj) => {
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

const closeOutsideBattery = () => {
  if (outsideBatteryName) {
    const n = outsideBatteryName.split('~');
    const battery = scene.getObjectByName(`${n[0]}~outside`);
    new TWEEN.Tween(battery.position, tweenGroup)
      .to(
        {
          z:
            battery.position.z -
            (outsideBatteryName.includes('front') ? 50 : 100),
        },
        500
      )
      .easing()
      .onComplete(function () {
        outsideBatteryName = '';
      })
      .start();
    battery.name = `${n[0]}~inside`;
    battery.remove(batteryPop);
    batteryPop.element.remove();
    batteryPop = null;
  }
};

const closeOPenedDoor = () => {
  if (openedDoorName) {
    const n = openedDoorName.split('~');
    const openedDoor = scene.getObjectByName(`${n[0]}~open`);
    new TWEEN.Tween(openedDoor.rotation, tweenGroup)
      .to(
        {
          z: 0,
        },
        500
      )
      .easing()
      .onComplete(function () {
        openedDoorName = '';
      })
      .start();
    openedDoor.name = `${n[0]}~close`;
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
  if (objectName.includes('电池门')) {
    closeOutsideBattery();
    closeOPenedDoor();
    const v = objectName.split('~');
    new TWEEN.Tween(intersects[0].object.rotation, tweenGroup)
      .to(
        {
          z: v[1] === 'close' ? 90 * (Math.PI / 180) : 0,
        },
        500
      )
      .easing()
      .onComplete(function () {
        if (v[1] === 'close') {
          openedDoorName = objectName;
        }
      })
      .start();
    clickObj.name = v[1] === 'close' ? `${v[0]}~open` : `${v[0]}~close`;
  } else if (objectName.includes('单体电池')) {
    closeOutsideBattery();
    const v = objectName.split('~');
    new TWEEN.Tween(clickObj.position, tweenGroup)
      .to(
        {
          z:
            v[1] === 'inside'
              ? clickObj.position.z + (objectName.includes('front') ? 50 : 100)
              : clickObj.position.z - (objectName.includes('front') ? 50 : 100),
        },
        500
      )
      .easing()
      .onComplete(function () {
        if (v[1] === 'inside') {
          moveCameraToObject(clickObj, { x: 0, y: 150, z: 250 }, () =>
            createBatteryPop(clickObj)
          );
          outsideBatteryName = objectName;
        }
      })
      .start();
    clickObj.name = v[1] === 'inside' ? `${v[0]}~outside` : `${v[0]}~inside`;
  } else if (
    objectName.includes('电池柜') ||
    objectName.includes('电源系统') ||
    objectName.includes('NRDA-300')
  ) {
    moveCameraToObject(clickObj);
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
      ledScreen.remove(ledScreenPop);
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
  const realRowNum = cabinetNum > rowNum ? rowNum : cabinetNum; //一行最多16个
  const offsetX = (10 - realRowNum) * 70 + realRowNum * 25; //根据电池柜数量计算偏移

  // 生成电源系统和控制面板的资产
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

  for (let cabinetIndex = 1; cabinetIndex <= cabinetNum; cabinetIndex++) {
    // 计算电池柜的行和列
    const rowIndex = Math.ceil(cabinetIndex / rowNum); // 当前柜子在哪一行
    const colIndex =
      cabinetIndex % rowNum === 0 ? rowNum : cabinetIndex % rowNum; // 当前柜子在当前行的哪一列

    // 添加电池柜和电池门
    loadAsset(
      'DCG_gui',
      {
        x: (colIndex - 10) * cabinetWidth + offsetX,
        y: 0,
        z: -(rowIndex - 1) * cabinetDepth,
      },
      `电池柜${cabinetIndex}`
    );
    loadAsset(
      'DCG_men',
      {
        x: (colIndex - 10) * cabinetWidth + offsetX,
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
          { x: xPos + offsetX, y: yPos, z: zPos },
          `单体电池-${batteryCounter}-front~inside`
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
          { x: xPos + offsetX, y: yPos, z: zPos },
          `单体电池-${batteryCounter}-back~inside`
        );
        batteryCounter++;
      }
    }
  }
};

/**创建电池弹窗气泡 */
const createBatteryPop = (model: any) => {
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
        batteryName: outsideBatteryName?.split('-')[1] || 'led显示屏',
      });
    },
  });
  loadPlugins(app);
  app.mount(div);
  // 创建 CSS2DObject
  batteryPop = new CSS2DObject(div);
  batteryPop.position.set(0, 0, 0);
  model.add(batteryPop);
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
        batteryName: outsideBatteryName?.split('-')[1] || 'led显示屏',
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

  // 设置文字样式
  context.fillStyle = 'white'; // 文字颜色
  context.font = '5px D-DIN'; // 文字字体
  context.textAlign = 'center'; // 文字水平居中
  context.textBaseline = 'middle'; // 文字垂直居中

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

const initScene = () => {
  initCamera();
  initLight();
  loader = new FBXLoader(manager);

  initBattery(200);
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
