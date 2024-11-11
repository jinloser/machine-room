/**
 * 泛用对象类型
 */
type GenericityObj<T = any> = Record<string, T>

/**
 * 泛用数组类型
 */
type GenericityAry = Array<GenericityObj>
