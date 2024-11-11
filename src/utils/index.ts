/**动态加载js */
export const initCDNJS = (src: string, loadCallback: Function) => {
  document.getElementById(`threeJs-${src}`)?.remove();
  const jsSrc = `./js/${src}.js`;
  const oHead = document
    .getElementsByTagName('HEAD')
    .item(0) as HTMLHeadElement;
  const oScript = document.createElement('script');
  oScript.type = 'text/javascript';
  oScript.id = `threeJs-${src}`;
  oScript.src = jsSrc;
  oHead.appendChild(oScript);
  oScript.onload = () => loadCallback();
};
