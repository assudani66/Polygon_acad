"use strict";

(function () {
  // global variables/constants used by puzzles' functions

  var LIST_NONE = "<none>";

  var _pGlob = {};

  _pGlob.objCache = {};
  _pGlob.fadeAnnotations = true;
  _pGlob.pickedObject = "";
  _pGlob.hoveredObject = "";
  _pGlob.mediaElements = {};
  _pGlob.loadedFile = "";
  _pGlob.states = [];
  _pGlob.percentage = 0;
  _pGlob.openedFile = "";
  _pGlob.xrSessionAcquired = false;
  _pGlob.xrSessionCallbacks = [];
  _pGlob.screenCoords = new v3d.Vector2();
  _pGlob.intervalTimers = {};

  _pGlob.AXIS_X = new v3d.Vector3(1, 0, 0);
  _pGlob.AXIS_Y = new v3d.Vector3(0, 1, 0);
  _pGlob.AXIS_Z = new v3d.Vector3(0, 0, 1);
  _pGlob.MIN_DRAG_SCALE = 10e-4;
  _pGlob.SET_OBJ_ROT_EPS = 1e-8;

  _pGlob.vec2Tmp = new v3d.Vector2();
  _pGlob.vec2Tmp2 = new v3d.Vector2();
  _pGlob.vec3Tmp = new v3d.Vector3();
  _pGlob.vec3Tmp2 = new v3d.Vector3();
  _pGlob.vec3Tmp3 = new v3d.Vector3();
  _pGlob.vec3Tmp4 = new v3d.Vector3();
  _pGlob.eulerTmp = new v3d.Euler();
  _pGlob.eulerTmp2 = new v3d.Euler();
  _pGlob.quatTmp = new v3d.Quaternion();
  _pGlob.quatTmp2 = new v3d.Quaternion();
  _pGlob.colorTmp = new v3d.Color();
  _pGlob.mat4Tmp = new v3d.Matrix4();
  _pGlob.planeTmp = new v3d.Plane();
  _pGlob.raycasterTmp = new v3d.Raycaster();

  var PL = (v3d.PL = v3d.PL || {});

  // a more readable alias for PL (stands for "Puzzle Logic")
  v3d.puzzles = PL;

  PL.procedures = PL.procedures || {};

  PL.execInitPuzzles = function (options) {
    // always null, should not be available in "init" puzzles
    var appInstance = null;
    // app is more conventional than appInstance (used in exec script and app templates)
    var app = null;

    var _initGlob = {};
    _initGlob.percentage = 0;
    _initGlob.output = {
      initOptions: {
        fadeAnnotations: true,
        useBkgTransp: false,
        preserveDrawBuf: false,
        useCompAssets: false,
        useFullscreen: true,
        useCustomPreloader: false,
        preloaderStartCb: function () {},
        preloaderProgressCb: function () {},
        preloaderEndCb: function () {},
      },
    };

    // provide the container's id to puzzles that need access to the container
    _initGlob.container =
      options !== undefined && "container" in options ? options.container : "";

    var PROC = {};

    // initSettings puzzle
    _initGlob.output.initOptions.fadeAnnotations = true;
    _initGlob.output.initOptions.useBkgTransp = false;
    _initGlob.output.initOptions.preserveDrawBuf = false;
    _initGlob.output.initOptions.useCompAssets = true;
    _initGlob.output.initOptions.useFullscreen = true;

    return _initGlob.output;
  };

  PL.init = function (appInstance, initOptions) {
    // app is more conventional than appInstance (used in exec script and app templates)
    var app = appInstance;

    initOptions = initOptions || {};

    if ("fadeAnnotations" in initOptions) {
      _pGlob.fadeAnnotations = initOptions.fadeAnnotations;
    }

    var PROC = {};

    var video, video_1;

    function MediaHTML5(isVideo) {
      this.source = null;
    }

    Object.assign(MediaHTML5.prototype, {
      load: function (url, isVideo) {
        if (isVideo) {
          this.source = document.createElement("video");
          this.source.playsInline = true;
          this.source.preload = "auto";
          this.source.autoload = true;
          this.source.crossOrigin = "anonymous";
        } else {
          this.source = document.createElement("audio");
        }

        this.source.src = url;
        return this;
      },

      play: function () {
        this.source.play();
      },

      pause: function () {
        this.source.pause();
      },

      stop: function () {
        this.source.pause();
        this.source.currentTime = 0;
      },

      rewind: function () {
        this.source.currentTime = 0;
      },

      setPlaybackTime: function (time) {
        this.source.currentTime = time;
      },

      getPlaybackTime: function () {
        return this.source.currentTime;
      },

      setPlaybackRate: function (rate) {
        this.source.playbackRate = rate;
      },

      isPlaying: function () {
        return this.source.duration > 0 && !this.source.paused;
      },

      setLoop: function (looped) {
        this.source.loop = looped;
      },

      setVolume: function (volume) {
        this.source.volume = volume;
      },

      setMuted: function (muted) {
        this.source.muted = muted;
      },
    });

    // loadVideo puzzle
    function loadVideo(url) {
      var elems = _pGlob.mediaElements;
      if (!(url in elems)) {
        elems[url] = new MediaHTML5().load(url, true);
      }
      return elems[url];
    }

    /**
     * Retreive standard accessible textures for MeshNodeMaterial or MeshStandardMaterial.
     * If "collectSameNameMats" is true then all materials in the scene with the given name will
     * be used for collecting textures, otherwise will be used only the first found material (default behavior).
     */
    function matGetEditableTextures(matName, collectSameNameMats) {
      var mats = [];
      if (collectSameNameMats) {
        mats = v3d.SceneUtils.getMaterialsByName(appInstance, matName);
      } else {
        var firstMat = v3d.SceneUtils.getMaterialByName(appInstance, matName);
        if (firstMat !== null) {
          mats = [firstMat];
        }
      }

      var textures = mats.reduce(function (texArray, mat) {
        var matTextures = [];
        switch (mat.type) {
          case "MeshNodeMaterial":
            matTextures = Object.values(mat.nodeTextures);
            break;

          case "MeshStandardMaterial":
            matTextures = [
              mat.map,
              mat.lightMap,
              mat.aoMap,
              mat.emissiveMap,
              mat.bumpMap,
              mat.normalMap,
              mat.displacementMap,
              mat.roughnessMap,
              mat.metalnessMap,
              mat.alphaMap,
              mat.envMap,
            ];
            break;

          default:
            console.error(
              "matGetEditableTextures: Unknown material type " + mat.type
            );
            break;
        }

        Array.prototype.push.apply(texArray, matTextures);
        return texArray;
      }, []);

      return textures.filter(function (elem) {
        // check Texture type exactly
        return (
          elem &&
          (elem.constructor == v3d.Texture ||
            elem.constructor == v3d.DataTexture ||
            elem.constructor == v3d.VideoTexture)
        );
      });
    }

    /**
     * Replace accessible textures for MeshNodeMaterial or MeshStandardMaterial
     */
    function matReplaceEditableTexture(mat, oldTex, newTex) {
      switch (mat.type) {
        case "MeshNodeMaterial":
          for (var name in mat.nodeTextures) {
            if (mat.nodeTextures[name] == oldTex) {
              mat.nodeTextures[name] = newTex;
            }
          }

          break;

        case "MeshStandardMaterial":
          var texNames = [
            "map",
            "lightMap",
            "aoMap",
            "emissiveMap",
            "bumpMap",
            "normalMap",
            "displacementMap",
            "roughnessMap",
            "metalnessMap",
            "alphaMap",
            "envMap",
          ];

          texNames.forEach(function (name) {
            if (mat[name] == oldTex) {
              mat[name] = newTex;
            }
          });

          break;

        default:
          console.error(
            "matReplaceEditableTexture: Unsupported material type " + mat.type
          );
          break;
      }

      // inherit some save params
      newTex.encoding = oldTex.encoding;
      newTex.wrapS = oldTex.wrapS;
      newTex.wrapT = oldTex.wrapT;
    }

    // replaceTexture puzzle
    function replaceTexture(
      matName,
      texName,
      texUrlOrElem,
      doCb,
      useCanvasVideoAlpha
    ) {
      var textures = matGetEditableTextures(matName, true).filter(function (
        elem
      ) {
        return elem.name == texName;
      });

      if (!textures.length) return;

      if (texUrlOrElem instanceof Promise) {
        texUrlOrElem.then(
          function (response) {
            processImageUrl(response);
          },
          function (error) {}
        );
      } else if (typeof texUrlOrElem == "string") {
        processImageUrl(texUrlOrElem);

        /**
         * NOTE: not checking for the MediaHTML5 constructor, because otherwise this
         * puzzle would always provide the code that's not needed most of the time
         */
      } else if (
        texUrlOrElem instanceof Object &&
        texUrlOrElem.source instanceof HTMLVideoElement
      ) {
        processVideo(texUrlOrElem.source);
      } else if (texUrlOrElem instanceof HTMLCanvasElement) {
        processCanvas(texUrlOrElem);
      } else {
        return;
      }

      function processImageUrl(url) {
        var isHDR = url.search(/\.hdr$/) > 0;

        if (!isHDR) {
          var loader = new v3d.ImageLoader();
          loader.setCrossOrigin("Anonymous");
        } else {
          var loader = new v3d.FileLoader();
          loader.setResponseType("arraybuffer");
        }

        loader.load(url, function (image) {
          // JPEGs can't have an alpha channel, so memory can be saved by storing them as RGB.
          var isJPEG =
            url.search(/\.(jpg|jpeg)$/) > 0 ||
            url.search(/^data\:image\/jpeg/) === 0;

          textures.forEach(function (elem) {
            if (!isHDR) {
              elem.image = image;
            } else {
              // parse loaded HDR buffer
              var rgbeLoader = new v3d.RGBELoader();
              var texData = rgbeLoader.parse(image);

              // NOTE: reset params since the texture may be converted to float
              elem.type = v3d.UnsignedByteType;
              elem.encoding = v3d.RGBEEncoding;

              elem.image = {
                data: texData.data,
                width: texData.width,
                height: texData.height,
              };

              elem.magFilter = v3d.LinearFilter;
              elem.minFilter = v3d.LinearFilter;
              elem.generateMipmaps = false;
              elem.isDataTexture = true;
            }

            elem.format = isJPEG ? v3d.RGBFormat : v3d.RGBAFormat;
            elem.needsUpdate = true;

            // update world material if it is using this texture
            if (
              appInstance.scene !== null &&
              appInstance.scene.worldMaterial !== null
            ) {
              var wMat = appInstance.scene.worldMaterial;
              for (var texName in wMat.nodeTextures) {
                if (wMat.nodeTextures[texName] == elem) {
                  appInstance.updateEnvironment(wMat);
                }
              }
            }
          });

          // exec once
          doCb();
        });
      }

      function processVideo(elem) {
        var videoTex = new v3d.VideoTexture(elem);
        videoTex.format = useCanvasVideoAlpha ? v3d.RGBAFormat : v3d.RGBFormat;
        videoTex.flipY = false;
        videoTex.name = texName;

        var videoAssigned = false;

        var mats = v3d.SceneUtils.getMaterialsByName(appInstance, matName);
        mats.forEach(function (mat) {
          textures.forEach(function (tex) {
            matReplaceEditableTexture(mat, tex, videoTex);
          });

          mat.needsUpdate = true;
          videoAssigned = true;
        });

        if (videoAssigned) doCb();
      }

      function processCanvas(elem) {
        var canvasTex = new v3d.CanvasTexture(elem);
        canvasTex.format = useCanvasVideoAlpha ? v3d.RGBAFormat : v3d.RGBFormat;
        canvasTex.flipY = false;
        canvasTex.name = texName;

        var canvasAssigned = false;

        var mats = v3d.SceneUtils.getMaterialsByName(appInstance, matName);
        mats.forEach(function (mat) {
          textures.forEach(function (tex) {
            matReplaceEditableTexture(mat, tex, canvasTex);
          });

          mat.needsUpdate = true;
          canvasAssigned = true;
        });

        if (canvasAssigned) {
          if (v3d.PL) {
            v3d.PL.canvasTextures = v3d.PL.canvasTextures || {};
            v3d.PL.canvasTextures[canvasTex.image.id] = canvasTex;
          }

          doCb();
        }
      }
    }

    // playSound puzzle
    function playSound(mediaElem, loop) {
      if (!mediaElem) return;
      mediaElem.setLoop(loop);
      mediaElem.play();
    }

    // utility function envoked by almost all V3D-specific puzzles
    // filter off some non-mesh types
    function notIgnoredObj(obj) {
      return (
        obj.type !== "AmbientLight" &&
        obj.name !== "" &&
        !(obj.isMesh && obj.isMaterialGeneratedMesh) &&
        !obj.isAuxClippingMesh
      );
    }

    // utility function envoked by almost all V3D-specific puzzles
    // find first occurence of the object by its name
    function getObjectByName(objName) {
      var objFound;
      var runTime = _pGlob !== undefined;
      objFound = runTime ? _pGlob.objCache[objName] : null;

      if (objFound && objFound.name === objName) return objFound;

      appInstance.scene.traverse(function (obj) {
        if (!objFound && notIgnoredObj(obj) && obj.name == objName) {
          objFound = obj;
          if (runTime) {
            _pGlob.objCache[objName] = objFound;
          }
        }
      });
      return objFound;
    }

    // utility function envoked by almost all V3D-specific puzzles
    // retrieve all objects on the scene
    function getAllObjectNames() {
      var objNameList = [];
      appInstance.scene.traverse(function (obj) {
        if (notIgnoredObj(obj)) objNameList.push(obj.name);
      });
      return objNameList;
    }

    // utility function envoked by almost all V3D-specific puzzles
    // retrieve all objects which belong to the group
    function getObjectNamesByGroupName(targetGroupName) {
      var objNameList = [];
      appInstance.scene.traverse(function (obj) {
        if (notIgnoredObj(obj)) {
          var groupNames = obj.groupNames;
          if (!groupNames) return;
          for (var i = 0; i < groupNames.length; i++) {
            var groupName = groupNames[i];
            if (groupName == targetGroupName) {
              objNameList.push(obj.name);
            }
          }
        }
      });
      return objNameList;
    }

    // utility function envoked by almost all V3D-specific puzzles
    // process object input, which can be either single obj or array of objects, or a group
    function retrieveObjectNames(objNames) {
      var acc = [];
      retrieveObjectNamesAcc(objNames, acc);
      return acc.filter(function (name) {
        return name;
      });
    }

    function retrieveObjectNamesAcc(currObjNames, acc) {
      if (typeof currObjNames == "string") {
        acc.push(currObjNames);
      } else if (Array.isArray(currObjNames) && currObjNames[0] == "GROUP") {
        var newObj = getObjectNamesByGroupName(currObjNames[1]);
        for (var i = 0; i < newObj.length; i++) acc.push(newObj[i]);
      } else if (
        Array.isArray(currObjNames) &&
        currObjNames[0] == "ALL_OBJECTS"
      ) {
        var newObj = getAllObjectNames();
        for (var i = 0; i < newObj.length; i++) acc.push(newObj[i]);
      } else if (Array.isArray(currObjNames)) {
        for (var i = 0; i < currObjNames.length; i++)
          retrieveObjectNamesAcc(currObjNames[i], acc);
      }
    }

    // zoomCamera puzzle
    function zoomCamera(objSelector, duration, doSlot) {
      duration = Math.max(0, duration);

      var objNames = retrieveObjectNames(objSelector);

      var zoomObjects = [];
      objNames.forEach(function (name) {
        var obj = getObjectByName(name);
        if (obj) {
          zoomObjects.push(obj);
        }
      });

      if (!zoomObjects.length) {
        return;
      }

      var camera = appInstance.getCamera();

      var pos = _pGlob.vec3Tmp,
        target = _pGlob.vec3Tmp2;
      v3d.CameraUtils.calcCameraZoomToObjectsParams(
        camera,
        zoomObjects,
        pos,
        target
      );

      if (appInstance.controls && appInstance.controls.tween) {
        // orbit and flying cameras
        if (!appInstance.controls.inTween) {
          appInstance.controls.tween(pos, target, duration, doSlot);
        }
      } else {
        // TODO: static camera, just position it for now
        if (camera.parent) {
          camera.parent.worldToLocal(pos);
        }
        camera.position.copy(pos);
        camera.lookAt(target);
        doSlot();
      }
    }

    /**
     * Retrieve coordinate system from the loaded scene
     */
    function getCoordSystem() {
      var scene = appInstance.scene;

      if (
        scene &&
        "v3d" in scene.userData &&
        "coordSystem" in scene.userData.v3d
      ) {
        return scene.userData.v3d.coordSystem;
      } else {
        // COMPAT: <2.17, consider replacing to 'Y_UP_RIGHT' for scenes with unknown origin
        return "Z_UP_RIGHT";
      }
    }

    /**
     * Transform coordinates from one space to another
     * Can be used with Vector3 or Euler.
     */
    function coordsTransform(coords, from, to, noSignChange) {
      if (from == to) return coords;

      var y = coords.y,
        z = coords.z;

      if (from == "Z_UP_RIGHT" && to == "Y_UP_RIGHT") {
        coords.y = z;
        coords.z = noSignChange ? y : -y;
      } else if (from == "Y_UP_RIGHT" && to == "Z_UP_RIGHT") {
        coords.y = noSignChange ? z : -z;
        coords.z = y;
      } else {
        console.error("coordsTransform: Unsupported coordinate space");
      }

      return coords;
    }

    /**
     * Verge3D euler rotation to Blender/Max shortest.
     * 1) Convert from intrinsic rotation (v3d) to extrinsic XYZ (Blender/Max default
     *    order) via reversion: XYZ -> ZYX
     * 2) swizzle ZYX->YZX
     * 3) choose the shortest rotation to resemble Blender's behavior
     */
    var eulerV3DToBlenderShortest = (function () {
      var eulerTmp = new v3d.Euler();
      var eulerTmp2 = new v3d.Euler();
      var vec3Tmp = new v3d.Vector3();

      return function (euler, dest) {
        var eulerBlender = eulerTmp.copy(euler).reorder("YZX");
        var eulerBlenderAlt = eulerTmp2.copy(eulerBlender).makeAlternative();

        var len = eulerBlender.toVector3(vec3Tmp).lengthSq();
        var lenAlt = eulerBlenderAlt.toVector3(vec3Tmp).lengthSq();

        dest.copy(len < lenAlt ? eulerBlender : eulerBlenderAlt);
        return coordsTransform(dest, "Y_UP_RIGHT", "Z_UP_RIGHT");
      };
    })();

    // tweenCamera puzzle
    function tweenCamera(
      posOrObj,
      targetOrObj,
      duration,
      doSlot,
      movementType
    ) {
      var camera = appInstance.getCamera();

      if (Array.isArray(posOrObj)) {
        var worldPos = _pGlob.vec3Tmp.fromArray(posOrObj);
        worldPos = coordsTransform(worldPos, getCoordSystem(), "Y_UP_RIGHT");
      } else if (posOrObj) {
        var posObj = getObjectByName(posOrObj);
        if (!posObj) return;
        var worldPos = posObj.getWorldPosition(_pGlob.vec3Tmp);
      } else {
        // empty input means: don't change the position
        var worldPos = camera.getWorldPosition(_pGlob.vec3Tmp);
      }

      if (Array.isArray(targetOrObj)) {
        var worldTarget = _pGlob.vec3Tmp2.fromArray(targetOrObj);
        worldTarget = coordsTransform(
          worldTarget,
          getCoordSystem(),
          "Y_UP_RIGHT"
        );
      } else {
        var targObj = getObjectByName(targetOrObj);
        if (!targObj) return;
        var worldTarget = targObj.getWorldPosition(_pGlob.vec3Tmp2);
      }

      duration = Math.max(0, duration);

      if (appInstance.controls && appInstance.controls.tween) {
        // orbit and flying cameras
        if (!appInstance.controls.inTween) {
          appInstance.controls.tween(
            worldPos,
            worldTarget,
            duration,
            doSlot,
            movementType
          );
        }
      } else {
        // TODO: static camera, just position it for now
        if (camera.parent) {
          camera.parent.worldToLocal(worldPos);
        }
        camera.position.copy(worldPos);
        camera.lookAt(worldTarget);
        doSlot();
      }
    }

    // utility function used by the whenClicked, whenHovered and whenDraggedOver puzzles
    function initObjectPicking(
      callback,
      eventType,
      mouseDownUseTouchStart,
      mouseButtons
    ) {
      var elem = appInstance.renderer.domElement;
      elem.addEventListener(eventType, pickListener);
      if (v3d.PL.editorEventListeners)
        v3d.PL.editorEventListeners.push([elem, eventType, pickListener]);

      if (eventType == "mousedown") {
        var touchEventName = mouseDownUseTouchStart ? "touchstart" : "touchend";
        elem.addEventListener(touchEventName, pickListener);
        if (v3d.PL.editorEventListeners)
          v3d.PL.editorEventListeners.push([
            elem,
            touchEventName,
            pickListener,
          ]);
      } else if (eventType == "dblclick") {
        var prevTapTime = 0;

        function doubleTapCallback(event) {
          var now = new Date().getTime();
          var timesince = now - prevTapTime;

          if (timesince < 600 && timesince > 0) {
            pickListener(event);
            prevTapTime = 0;
            return;
          }

          prevTapTime = new Date().getTime();
        }

        var touchEventName = mouseDownUseTouchStart ? "touchstart" : "touchend";
        elem.addEventListener(touchEventName, doubleTapCallback);
        if (v3d.PL.editorEventListeners)
          v3d.PL.editorEventListeners.push([
            elem,
            touchEventName,
            doubleTapCallback,
          ]);
      }

      var raycaster = new v3d.Raycaster();

      function pickListener(event) {
        // to handle unload in loadScene puzzle
        if (!appInstance.getCamera()) return;

        event.preventDefault();

        var xNorm = 0,
          yNorm = 0;
        if (event instanceof MouseEvent) {
          if (mouseButtons && mouseButtons.indexOf(event.button) == -1) return;
          xNorm = event.offsetX / elem.clientWidth;
          yNorm = event.offsetY / elem.clientHeight;
        } else if (event instanceof TouchEvent) {
          var rect = elem.getBoundingClientRect();
          xNorm = (event.changedTouches[0].clientX - rect.left) / rect.width;
          yNorm = (event.changedTouches[0].clientY - rect.top) / rect.height;
        }

        _pGlob.screenCoords.x = xNorm * 2 - 1;
        _pGlob.screenCoords.y = -yNorm * 2 + 1;
        raycaster.setFromCamera(
          _pGlob.screenCoords,
          appInstance.getCamera(true)
        );
        var objList = [];
        appInstance.scene.traverse(function (obj) {
          objList.push(obj);
        });
        var intersects = raycaster.intersectObjects(objList);
        callback(intersects, event);
      }
    }

    function objectsIncludeObj(objNames, testedObjName) {
      if (!testedObjName) return false;

      for (var i = 0; i < objNames.length; i++) {
        if (testedObjName == objNames[i]) {
          return true;
        } else {
          // also check children which are auto-generated for multi-material objects
          var obj = getObjectByName(objNames[i]);
          if (obj && obj.type == "Group") {
            for (var j = 0; j < obj.children.length; j++) {
              if (testedObjName == obj.children[j].name) {
                return true;
              }
            }
          }
        }
      }
      return false;
    }

    // utility function used by the whenClicked, whenHovered, whenDraggedOver, and raycast puzzles
    function getPickedObjectName(obj) {
      // auto-generated from a multi-material object, use parent name instead
      if (obj.isMesh && obj.isMaterialGeneratedMesh && obj.parent) {
        return obj.parent.name;
      } else {
        return obj.name;
      }
    }

    // whenClicked puzzle
    function registerOnClick(
      objSelector,
      xRay,
      doubleClick,
      mouseButtons,
      cbDo,
      cbIfMissedDo
    ) {
      // for AR/VR
      _pGlob.objClickInfo = _pGlob.objClickInfo || [];

      _pGlob.objClickInfo.push({
        objSelector: objSelector,
        callbacks: [cbDo, cbIfMissedDo],
      });

      initObjectPicking(
        function (intersects, event) {
          var isPicked = false;

          var maxIntersects = xRay
            ? intersects.length
            : Math.min(1, intersects.length);

          for (var i = 0; i < maxIntersects; i++) {
            var obj = intersects[i].object;
            var objName = getPickedObjectName(obj);
            var objNames = retrieveObjectNames(objSelector);

            if (objectsIncludeObj(objNames, objName)) {
              // save the object for the pickedObject block
              _pGlob.pickedObject = objName;
              isPicked = true;
              cbDo(event);
            }
          }

          if (!isPicked) {
            _pGlob.pickedObject = "";
            cbIfMissedDo(event);
          }
        },
        doubleClick ? "dblclick" : "mousedown",
        false,
        mouseButtons
      );
    }

    video = loadVideo("path.mp4");
    replaceTexture("path", "path.mp4.001", video, function () {}, false);
    playSound(video, true);

    video_1 = loadVideo("Color Matte_3.mp4");
    replaceTexture(
      "Color Matte_3",
      "Color Matte_3.mp4",
      video_1,
      function () {},
      false
    );
    playSound(video_1, true);

    registerOnClick(
      "bitcoin_island",
      false,
      false,
      [0, 1, 2],
      function () {
        zoomCamera("bitcoin_island", 1, function () {});
        tweenCamera("camera_loc", [0, 0, 0], 1, function () {}, 1);
      },
      function () {}
    );

    registerOnClick(
      "ethereum_miner",
      false,
      false,
      [0, 1, 2],
      function () {
        zoomCamera("ethereum_miner", 1, function () {});
        tweenCamera("camera_loc", [0, 0, 0], 1, function () {}, 1);
      },
      function () {}
    );

    registerOnClick(
      "robotic_arm",
      false,
      false,
      [0, 1, 2],
      function () {
        zoomCamera("robotic_arm", 1, function () {});
        tweenCamera("camera_loc", [0, 0, 0], 1, function () {}, 1);
      },
      function () {}
    );

    registerOnClick(
      "swing-island",
      false,
      false,
      [0, 1, 2],
      function () {
        zoomCamera("swing-island", 1, function () {});
        tweenCamera("camera_loc", [0, 0, 0], 1, function () {}, 1);
      },
      function () {}
    );

    registerOnClick(
      "painting_island",
      false,
      false,
      [0, 1, 2],
      function () {
        zoomCamera("painting_island", 1, function () {});
        tweenCamera("camera_loc", [0, 0, 0], 1, function () {}, 1);
      },
      function () {}
    );

    registerOnClick(
      "sing_island",
      false,
      false,
      [0, 1, 2],
      function () {
        zoomCamera("sing_island", 1, function () {});
        tweenCamera("camera_loc", [0, 0, 0], 1, function () {}, 1);
      },
      function () {}
    );

    registerOnClick(
      "gaint_wheel_island",
      false,
      false,
      [0, 1, 2],
      function () {
        zoomCamera("Star001", 1, function () {});
        tweenCamera("camera_loc", [0, 0, 0], 1, function () {}, 1);
      },
      function () {}
    );

    registerOnClick(
      "island_body1.007",
      false,
      false,
      [0, 1, 2],
      function () {
        zoomCamera("island_body1.007", 1, function () {});
        tweenCamera("camera_loc", [0, 0, 0], 1, function () {}, 1);
      },
      function () {}
    );

    registerOnClick(
      "island_body1.005",
      false,
      false,
      [0, 1, 2],
      function () {
        zoomCamera("island_body1.005", 1, function () {});
        tweenCamera("camera_loc", [0, 0, 0], 1, function () {}, 1);
      },
      function () {}
    );

    registerOnClick(
      "gas_station_island",
      false,
      false,
      [0, 1, 2],
      function () {
        zoomCamera("gas_station_island", 1, function () {});
        tweenCamera("camera_loc", [0, 0, 0], 1, function () {}, 1);
      },
      function () {}
    );

    registerOnClick(
      "island_body1.001",
      false,
      false,
      [0, 1, 2],
      function () {
        zoomCamera("island_body1.001", 1, function () {});
        tweenCamera("camera_loc", [0, 0, 0], 1, function () {}, 1);
      },
      function () {}
    );
  }; // end of PL.init function
})(); // end of closure

/* ================================ end of code ============================= */
