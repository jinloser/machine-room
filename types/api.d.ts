/** 所有 api 接口的响应数据都应该准守该格式 */
interface IApiResponseData<T> {
  code: number
  data: T
  msg: string
}

/**
 * 带有分页器的api参数接口
 */
interface IPagerAPIParam<T> {
  current: number
  size: number
  model: T
}

/**
 * 部分api的响应数据结构，如添加、删除、编辑类的接口
 */
interface IApiResponseDataType2<T> {
  code: number
  success: T
  msg: string
}
