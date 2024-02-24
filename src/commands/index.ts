import * as ping from "./ping"
import { join,
    leave,
    stop,
    add,
    remove,
    listtracks,
    togglepause,
    playurl,
    toggleloop ,
    prev,
    next,
    play }  from "./musicplayer"

import {
    addeffect,
    removeeffect,
    toggleloopeffect,
    stopeffect,
    togglepauseeffect,
    playurleffect,
    playeffect,
    listeffects } from './soundeffects'

export default {
    ping,
    join,
    leave,
    stop,
    add,
    remove,
    listtracks,
    togglepause,
    toggleloop,
    prev,
    next,
    play,
    playurl,
    addeffect,
    stopeffect,
    removeeffect,
    togglepauseeffect,
    toggleloopeffect,
    playurleffect,
    playeffect,
    listeffects
}
