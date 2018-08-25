import React, { PureComponent } from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import { push } from 'react-router-redux'
import { createStructuredSelector } from 'reselect'
import { increment, incrementAsync, decrement } from './actions'
import { selectCount } from './selectors'
import _ from 'lodash'

import events from 'utils/events'
import { healToken, checkToken } from 'utils/auth'
import api from 'utils/api'
import { readableSize, jackettLinkAnchor } from 'utils/misc'
import modals from 'utils/modals'
import player from 'utils/player'

let dataTimeout
let focused

const next = function() {
  const fetchData = () => {
    dataTimeout = false
    getData.call(this)
  }
  if (!dataTimeout)
    dataTimeout = setTimeout(fetchData, 1500)
}

const getData = async function() {

  if (focused) {

    const parsed = await api.get({ method: 'getall', json: true })

    const parsedAce = await api.get({ method: 'getallace', json: true})

    if (parsed || parsedAce) {

      const parsedAll = parsed && parsedAce ? Object.assign(parsed, parsedAce) : parsed ? parsed : parsedAce ? parsedAce : null

      if (!focused) return

      if (_.size(parsedAll)) {
        let totalUsed = 0
        const ordered = _.orderBy(parsedAll, function(e) { if (e.downloaded) totalUsed += e.downloaded; return e.utime }, ['desc'])
        const readableTotalUsed = readableSize(totalUsed);
        events.emit('navTitle', { title: readableTotalUsed })
        window.lastTorrentId = ordered[Object.keys(ordered)[0]].utime;
        this.setState({
          noTorrents: false,
          torrents: ordered
        })
      } else {
        this.setState({
          noTorrents: true,
          torrents: {}
        })
      }
    } else {
      healToken(() => {checkToken(true)})
    }

    next.call(this)

  }
}

let dataInterval

export default class Counter extends PureComponent {
  constructor (props) {
    super(props)

    this.state = {
      torrents: {},
      activeTorrents: [],
      noTorrents: false
    }
  }

  openFileMenu = (torrentId) => {
    modals.open('torrentOpts', { torrent: this.state.torrents[torrentId] })
  }

  openAceFileMenu = (aceObj) => {
    modals.open('aceOpts', { ace: aceObj })
  }

  playAceFile = (aceHash) => {
    const playButtonAction = JSON.parse(localStorage.getItem('playButtonAction'))

    if (playButtonAction) {
      modals.open('ace', { pid: aceHash, shouldDo: 'web' })
    } else {
      if (window.isMaster) {
        api.get({ method: 'runAcePlaylist', pid: aceHash })
      } else {
        modals.open('ace', { pid: aceHash, shouldDo: 'playlist' })
      }
    }
  }

  playFile = async (el) => {

    const playButtonAction = JSON.parse(localStorage.getItem('playButtonAction'))

    let pattern = {
      type: 'getplaylist.m3u',
      id: el.infoHash || el.id
    }

    let torrentData
    let streamableFile

    if (playButtonAction) {

      modals.open('loading')

      let isCanceled = false
      const hasCanceled = () => {
        events.off('canceledLoading', hasCanceled)
        isCanceled = true
      }
      events.on('canceledLoading', hasCanceled)

      window.loadingTorrents[el.infoHash] = true

      await api.get(pattern)

      torrentData = await api.get({ method: 'torrentData', id: el.infoHash, json: true })

      window.loadingTorrents[el.infoHash] = false

      torrentData.files.some((file) => {
        if (file.streamable) {
          streamableFile = file
          return true
        }
      })

      if (isCanceled)
        return

    }

    if (playButtonAction && torrentData && streamableFile) {
      player.modal.open(torrentData, streamableFile)
    } else {

      if (window.isMaster) {

        if (!playButtonAction) {
          // we check for streamable file again here, as it wasn't checked
          // for before and not all cases need to do this additional data request
          torrentData = await api.get({ method: 'torrentData', id: el.infoHash, json: true })

          torrentData.files.some((file) => {
            if (file.streamable) {
              streamableFile = file
              return true
            }
          })
        }

        if (streamableFile) {
          pattern.openNow = true
          api.get(pattern)
        } else
          api.get({ method: 'torrentLoc', infoHash: el.infoHash })

      } else {
        window.open(api.parseUrl(pattern), "_blank")
      }
    }
  }

  openTorrent = async (el) => {
    if (!el.running) {
      window.loadingTorrents[el.infoHash] = true

      modals.open('loading')

      let isCanceled = false
      const hasCanceled = () => {
        events.off('canceledLoading', hasCanceled)
        isCanceled = true
      }
      events.on('canceledLoading', hasCanceled)

//      document.getElementById("loadingDialog").open()
      await api.get({
        type: 'getplaylist.m3u',
        id: el.infoHash || el.id
      })

      if (!isCanceled) {
        if (document.getElementById("loadingDialog"))
          document.getElementById("loadingDialog").close()
        this.props.dispatch(push('/torrent?hash='+el.infoHash))
      }
      delete window.loadingTorrents[el.infoHash]
    } else {
        this.props.dispatch(push('/torrent?hash='+el.infoHash))
    }
  }

  torrentList = () => {

    let fileList = []

    let backColor = '#3e3e3e'

    _.forEach(this.state.torrents, (el, ij) => {

      if (!el) return

      backColor = backColor == '#444' ? '#3e3e3e' : '#444'

      if (el.isLive) {

        const fileFinished = true
        const filePercent = 1
        const fileProgress = 100

        const newFile = (
            <div key={ij} className="dashboardFile" style={{backgroundColor: backColor}}>
                <div className="dashboardFileButtonHold">
                    <paper-fab icon={ 'menu' } onClick={this.openAceFileMenu.bind(this, el)} style={{ backgroundColor: fileFinished ? '#11a34e' : el.selected ? '#e38318' : '#e3b618' }} />
                    <paper-fab icon={ 'av:play-arrow' } onClick={this.playAceFile.bind(this, el.pid)} style={{ backgroundColor: fileFinished ? '#11a34e' : el.selected ? '#e38318' : '#e3b618' }} />
                </div>
                <div className="torrentFile" onClick={this.openAceFileMenu.bind(this, el)}>
                    <div className="torrentFileProgressHold">
                        <progress-bubble value={fileProgress} max="100" stroke-width="5">
                            <strong>{fileProgress}<span>%</span></strong>
                        </progress-bubble>
                    </div>
                    <div className="torrentFileDetails">
                        <div className="torrentFileName">{el.name} <span className="torrentFileState" style={{ backgroundColor: el.running ? 'rgb(17, 163, 78)' : window.loadingTorrents[el.infoHash] ? '#EFA047' : 'rgb(96, 96, 96)' }}></span></div>
                        <div className="torrentFileSubtitle">Live</div>
                    </div>
                    <div style={{clear: 'both'}} />
                </div>
                <div style={{clear: 'both'}} />
            </div>
        )

        fileList.push(newFile)

      } else {

        const fileFinished = (el.downloaded >= el.totalSize)
        const filePercent = fileFinished ? 1 : el.downloaded / el.totalSize
        const fileProgress = Math.round(filePercent * 100)

        const newFile = (
            <div key={ij} className="dashboardFile" style={{backgroundColor: backColor}}>
                <div className="dashboardFileButtonHold">
                    <paper-fab icon={ 'menu' } onClick={this.openFileMenu.bind(this, ij)} style={{ backgroundColor: fileFinished ? '#11a34e' : el.selected ? '#e38318' : '#e3b618' }} />
                    <paper-fab icon={ 'av:play-arrow' } onClick={this.playFile.bind(this, el)} style={{ backgroundColor: fileFinished ? '#11a34e' : el.selected ? '#e38318' : '#e3b618' }} />
                </div>
                <div className="torrentFile" onClick={this.openTorrent.bind(this, el)}>
                    <div className="torrentFileProgressHold">
                        <progress-bubble value={fileProgress} max="100" stroke-width="5">
                            <strong>{fileProgress}<span>%</span></strong>
                        </progress-bubble>
                    </div>
                    <div className="torrentFileDetails">
                        <div className="torrentFileName">{el.name} <span className="torrentFileState" style={{ backgroundColor: el.running ? 'rgb(17, 163, 78)' : window.loadingTorrents[el.infoHash] ? '#EFA047' : 'rgb(96, 96, 96)' }}></span></div>
                        <div className="torrentFileSubtitle">Downloaded: {fileFinished ? readableSize(el.totalSize) : readableSize(el.totalSize * filePercent)} / {readableSize(el.totalSize)}</div>
                        <div className="torrentFileSubtitle">Uploaded: {readableSize((el.uploadedStart || 0) + el.uploaded)}</div>
                    </div>
                    <div style={{clear: 'both'}} />
                </div>
                <div style={{clear: 'both'}} />
            </div>
        )

        fileList.push(newFile)

      }

    })


    return fileList
  }

  externalJackettLink = () => {
    api.get({ method: 'jackettLink', anchor: jackettLinkAnchor() })
  }

  onfocus = () => {
    focused = true
    getData.call(this)
  }

  onblur = () => {
    focused = false
    if (dataTimeout)
      clearTimeout(dataTimeout)
    dataTimeout = false
  }

  componentDidMount = () => {

    document.title = 'Dashboard - Powder Web'

    api.secureToken()

    const renderNotFocused = JSON.parse(localStorage.getItem('renderNotFocused'))

    if (renderNotFocused) {
      focused = true
      this.onfocus()
    } else {
      focused = document.hasFocus()
      window.addEventListener("focus", this.onfocus)
      window.addEventListener("blur", this.onblur)
      getData.call(this)
    }

    player.init()

    const checkHaveSync = async () => {
      const haveSyncParsed = await api.get({ method: 'haveSyncBrowser', json: true })

      if (haveSyncParsed && haveSyncParsed.value) {
        window.haveSyncBrowser = true
        events.emit('updateNav')
      }
    }

    checkHaveSync()

  }

  componentWillUnmount = () => {

    // we remove these even if their not added, for safety:
    window.removeEventListener("focus", this.onfocus)
    window.removeEventListener("blur", this.onblur)
    this.onblur()

    player.modal.close()
  }

  render() {
    return (
      <div className='listContainer'>
        <div style={{ display: this.state.noTorrents ? 'block' : 'none', textAlign: 'left', color: 'rgba(255,255,255,0.8)', fontWeight: '100', fontSize: '14px', padding: '30px 35px', lineHeight: '20px' }}>
          You have no torrents added. You can add torrents by:<div style={{height: '11px'}} />
          - pressing the "+" button in the top navigation bar<div style={{height: '11px'}} />
          - associating Powder Web with Magnet Links / Torrent Files from the Settings Panel (button with gear icon in the top navigation bar)<div style={{height: '11px'}} />
          - downloading and installing <span className="whiteLink" onClick={this.externalJackettLink.bind(this)}>Jackett</span> locally then configuring it to search your favorite torrent sites from the search button (navigation bar)
        </div>
        {this.torrentList()}
      </div>
    )
  }
}
