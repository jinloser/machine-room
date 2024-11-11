<template>
  <div class="scene-container" ref="sceneContainer"></div>
</template>

<script lang="ts" setup>
import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { onMounted, ref } from 'vue';
import TWEEN from '@tweenjs/tween.js';
import {
  CSS2DRenderer,
  CSS2DObject,
} from 'three/examples/jsm/renderers/CSS2DRenderer.js';

const sceneContainer = ref<any>();

const manager = new THREE.LoadingManager();

let camera: any,
  scene: any,
  renderer: any,
  stats: any,
  loader: any,
  controls: any,
  outsideBatteryName: any;

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
        child.castShadow = true;
        child.receiveShadow = true;
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
    const textObj = scene.getObjectByName(outsideBatteryName + 'TEXT');
    new TWEEN.Tween(textObj.position, tweenGroup)
      .to(
        {
          z:
            textObj.position.z -
            (outsideBatteryName.includes('front') ? 50 : 100),
        },
        500
      )
      .easing()
      .onComplete(function () {})
      .start();
    battery.name = `${n[0]}~inside`;
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
    closeOutsideBattery();
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
          lookAtModel(clickObj);
          outsideBatteryName = objectName;
        }
      })
      .start();

    const textObj = scene.getObjectByName(objectName + 'TEXT');
    new TWEEN.Tween(textObj.position, tweenGroup)
      .to(
        {
          z:
            v[1] === 'inside'
              ? textObj.position.z + (objectName.includes('front') ? 50 : 100)
              : textObj.position.z - (objectName.includes('front') ? 50 : 100),
        },
        500
      )
      .easing()
      .onComplete(function () {})
      .start();
    clickObj.name = v[1] === 'inside' ? `${v[0]}~outside` : `${v[0]}~inside`;
  } else if (objectName.includes('电池柜')) {
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
      controls.target.copy(targetPosition);
      controls.update();
    })
    .start();
};

const lookAtModel = (model: any) => {
  // 获取模型的包围盒
  const box = new THREE.Box3().setFromObject(model); // model 是需要聚焦的模型

  // 获取模型的中心点和尺寸
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  // 计算相机应该距离模型的距离，确保整个模型在视野中
  const maxDim = Math.max(size.x, size.y, size.z); // 模型的最大维度
  const fov = camera.fov * (Math.PI / 180); // 相机视角的弧度值
  let cameraDistance = maxDim / (2 * Math.tan(fov / 2)); // 相机距离

  // 将相机移动到合适的位置
  camera.position.copy(center);
  camera.position.x += cameraDistance - 50;
  camera.position.y += cameraDistance - 50;
  camera.position.z += cameraDistance + 5;

  // 让相机看向模型的中心点
  camera.lookAt(center);
  controls.target.copy(center);
  controls.update();

  // 更新渲染器
  renderer.render(scene, camera);
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
          `单体电池${batteryCounter}-front~inside`,
          (model: any) => {
            createBatteryText(model);
          }
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
          `单体电池${batteryCounter}-back~inside`,
          (model: any) => {
            createBatteryText(model);
          }
        );
        batteryCounter++;
      }
    }
  }
};

const createBatteryText = (model: any) => {
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

  // 在 Canvas 上绘制文字
  context.fillText(
    model.children[0].name.split('-')[0],
    canvas.width / 2,
    canvas.height / 2
  ); // 使文字居中

  // 将Canvas转换为纹理
  const texture = new THREE.CanvasTexture(canvas);

  // 创建材质和几何体
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
  });
  const geometry = new THREE.PlaneGeometry(10, 10);

  // 创建平面
  const plane = new THREE.Mesh(geometry, material);
  const { x, y, z } = model.position;
  // 设置平面位置
  plane.position.set(x, y + 25, z + 22);
  // plane.position.set(x, y + 15, z + 20);
  plane.name = model.children[0].name + 'TEXT';

  // 将平面添加到场景中
  scene.add(plane);
};

const initScene = () => {
  initCamera();
  initLight();
  loader = new FBXLoader(manager);

  initBattery(240);
  initRanderer();
  initControls();

  window.addEventListener('resize', onWindowResize);
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
