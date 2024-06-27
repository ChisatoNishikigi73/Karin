import lodash from 'lodash'
import logger from './logger'
import { KarinMessage } from 'karin/event/message'
import { PluginType, dirName, fileName } from 'karin/types/plugin'

export const button = new (class Button {
  Apps: Array<{
    App: new () => PluginType
    name: string
    priority: number
    file: { dir: dirName; name: fileName }
    rule: Array<{ reg: RegExp; fnc: string }>
  }>

  constructor () {
    this.Apps = []
  }

  add ({ name, dir, App, Class }: { dir: dirName; name: fileName; App: new () => PluginType; Class: PluginType }) {
    const rule = []
    /** 创建正则表达式 */
    for (const v of Class.button) {
      try {
        const { reg, fnc } = v
        rule.push({ reg: new RegExp(reg), fnc })
      } catch (error) {
        logger.error(error)
        continue
      }
    }

    this.Apps.push({
      App,
      name: Class.name,
      priority: Class.priority,
      file: { name, dir },
      rule,
    })
  }

  /**
   * 卸载按钮
   * @param {string} dir 插件目录
   * @param {string} name 插件文件名称
   */
  del (dir: dirName, name: fileName) {
    /** 未传入name则删除所有 */
    if (!name) {
      this.Apps = this.Apps.filter(v => v.file.dir !== dir)
    } else {
      /** 传入name则删除指定 */
      this.Apps = this.Apps.filter(v => v.file.dir !== dir || v.file.name !== name)
    }
    /** 排序 */
    this.Apps = lodash.orderBy(this.Apps, ['priority'], ['asc'])
    return this.Apps
  }

  update ({ dir, name, App, Class }: { dir: dirName; name: fileName; App: new () => PluginType; Class: PluginType }) {
    this.del(dir, name)
    this.add({ name, dir, App, Class })
  }

  async get (e: KarinMessage) {
    const button = []
    for (const app of this.Apps) {
      for (const v of app.rule) {
        /** 这里的lastIndex是为了防止正则无法从头开始匹配 */
        v.reg.lastIndex = 0
        if (v.reg.test(e.msg)) {
          try {
            const App = new app.App()
            App.e = e
            const res = await (App[v.fnc as keyof typeof App] as Function)(e)
            if (!res) continue
            /** 是否继续循环 */
            const cycle = res.cycle ?? true
            delete res.cycle
            button.push(res)
            if (cycle !== false) return button
          } catch (error) {
            logger.error(error)
          }
        }
      }
    }
    /** 理论上不会走到这里，但是还是要稳一手，不排除有所有插件都false... */
    return button
  }
})()
