import * as ping from "./ping"
import { join,
    leave,
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
    toggleloopeffect ,
    togglepauseeffect,
    playurleffect,
    playeffect,
    listeffects } from './soundeffects'

export default {
    ping,
    join,
    leave,
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
    removeeffect,
    togglepauseeffect,
    toggleloopeffect,
    playurleffect,
    playeffect,
    listeffects
}
