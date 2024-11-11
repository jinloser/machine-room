<template>
  <div class="tip-content" :class="{ 'host-content': !props.isBattery }">
    <div class="arrow">
      <em></em>
      <span></span>
    </div>
    <div class="batteryInfo" v-if="props.isBattery">
      <ul>
        <li>
          <span>电池编号</span>
          <span>#{{ props.batteryName }}</span>
        </li>
        <li>
          <span>电压</span>
          <span>2.21V</span>
        </li>
        <li>
          <span>温度</span>
          <span>27.8℃</span>
        </li>
        <li>
          <span>内阻</span>
          <span>0.556mΩ</span>
        </li>
      </ul>
    </div>
    <div class="hostInfo" v-else>
      <ul>
        <li>
          <span>主机名称</span>
          <span>武汉通讯电源</span>
        </li>
        <li>
          <span>状态</span>
          <span>在线浮充</span>
        </li>
        <li>
          <span>在线电压</span>
          <span>53.35V</span>
        </li>
        <li>
          <span>组端电压</span>
          <span>53.35V</span>
        </li>
        <li>
          <span>组端电流</span>
          <span>0.78A</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script lang="ts" setup>
const props = defineProps({
  isBattery: {
    type: Boolean,
    default: true,
  },
  batteryName: {
    type: String,
    default: '',
  },
});
</script>

<style lang="less" scoped>
.tip-content {
  width: 138px;
  background: rgba(37, 61, 80, 0.5);
  box-shadow: 6px 6px 10px 0px rgba(0, 0, 0, 0.3);
  border: 2px solid;
  border-image: linear-gradient(
      180deg,
      rgba(246, 95, 23, 0),
      rgba(255, 156, 51, 0.5)
    )
    2 2;
  border-radius: 8px;
  position: relative;
  z-index: 9999;
  padding: 10px;
  margin-bottom: 225px;
  &.host-content {
    width: 180px;
    .arrow {
      left: 80px;
    }
  }
}
.arrow {
  position: absolute;
  width: 12px;
  height: 12px;
  bottom: -12px;
  left: 60px;
}
.arrow * {
  display: block;
  border-width: 8px;
  position: absolute;
  border-style: solid dashed dashed dashed;
  font-size: 0;
  line-height: 0;
}
.arrow em {
  border-color: rgba(255, 156, 51, 0.5) transparent transparent;
}
.arrow span {
  border-color: rgba(255, 156, 51, 0.5) transparent transparent;
  top: 0px;
}
.batteryInfo,
.hostInfo {
  ul {
    list-style: none;
    font-size: 13px;
    color: #fff;
    padding: 0;
    margin: 0;
    li {
      line-height: 26px;
      color: #fff;
      display: flex;
      justify-content: space-between;
      span:nth-of-type(1) {
        color: rgba(255, 255, 255, 0.5);
      }
    }
  }
}
</style>
