/**
 * 주어진 ID가 UUID 형식인지에 대한 여부를 반환합니다.
 *
 * @param id 검사할 ID의 값
 */
export const validateUUID = (id: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  )
}
