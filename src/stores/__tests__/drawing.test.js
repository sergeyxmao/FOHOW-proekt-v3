import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDrawingStore } from '../drawing'

describe('useDrawingStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('State initialization', () => {
    it('should initialize with empty objects array', () => {
      const store = useDrawingStore()
      expect(store.objects).toEqual([])
    })

    it('should initialize with null selectedObjectId', () => {
      const store = useDrawingStore()
      expect(store.selectedObjectId).toBe(null)
    })
  })

  describe('addObject', () => {
    it('should add object to objects array', () => {
      const store = useDrawingStore()
      const object = {
        id: 'test-1',
        type: 'image',
        x: 100,
        y: 100,
        zIndex: 1
      }

      store.addObject(object)

      expect(store.objects).toHaveLength(1)
      expect(store.objects[0]).toMatchObject(object)
    })

    it('should set selectedObjectId to new object id', () => {
      const store = useDrawingStore()
      const object = { id: 'test-1', type: 'image' }

      store.addObject(object)

      expect(store.selectedObjectId).toBe('test-1')
    })

    it('should set isSelected to true for new object', () => {
      const store = useDrawingStore()
      const object = { id: 'test-1', type: 'image' }

      store.addObject(object)

      expect(store.objects[0].isSelected).toBe(true)
    })

    it('should deselect other objects when adding new object', () => {
      const store = useDrawingStore()
      const object1 = { id: 'test-1', type: 'image' }
      const object2 = { id: 'test-2', type: 'image' }

      store.addObject(object1)
      store.addObject(object2)

      expect(store.objects[0].isSelected).toBe(false)
      expect(store.objects[1].isSelected).toBe(true)
      expect(store.selectedObjectId).toBe('test-2')
    })

    it('should generate id if not provided', () => {
      const store = useDrawingStore()
      const object = { type: 'image' }

      const result = store.addObject(object)

      expect(result.id).toBeDefined()
      expect(result.id).toMatch(/^obj_/)
    })
  })

  describe('removeObject', () => {
    it('should remove object from array', () => {
      const store = useDrawingStore()
      store.addObject({ id: 'test-1', type: 'image' })
      store.addObject({ id: 'test-2', type: 'image' })

      const result = store.removeObject('test-1')

      expect(result).toBe(true)
      expect(store.objects).toHaveLength(1)
      expect(store.objects[0].id).toBe('test-2')
    })

    it('should set selectedObjectId to null if removed object was selected', () => {
      const store = useDrawingStore()
      store.addObject({ id: 'test-1', type: 'image' })

      store.removeObject('test-1')

      expect(store.selectedObjectId).toBe(null)
    })

    it('should return false if object not found', () => {
      const store = useDrawingStore()
      const result = store.removeObject('non-existent')

      expect(result).toBe(false)
    })
  })

  describe('updateObject', () => {
    it('should update object properties', () => {
      const store = useDrawingStore()
      store.addObject({ id: 'test-1', type: 'image', x: 100, y: 100 })

      store.updateObject({
        id: 'test-1',
        updates: { x: 200, y: 200 }
      })

      expect(store.objects[0].x).toBe(200)
      expect(store.objects[0].y).toBe(200)
    })

    it('should return updated object', () => {
      const store = useDrawingStore()
      store.addObject({ id: 'test-1', type: 'image', x: 100 })

      const result = store.updateObject({
        id: 'test-1',
        updates: { x: 200 }
      })

      expect(result).toBeDefined()
      expect(result.x).toBe(200)
    })

    it('should return null if object not found', () => {
      const store = useDrawingStore()
      const result = store.updateObject({
        id: 'non-existent',
        updates: { x: 200 }
      })

      expect(result).toBe(null)
    })
  })

  describe('selectObject', () => {
    it('should set isSelected to true for specified object', () => {
      const store = useDrawingStore()
      store.objects = [
        { id: 'test-1', isSelected: false },
        { id: 'test-2', isSelected: false }
      ]
      store.selectedObjectId = null

      store.selectObject('test-1')

      expect(store.objects[0].isSelected).toBe(true)
      expect(store.selectedObjectId).toBe('test-1')
    })

    it('should deselect all other objects', () => {
      const store = useDrawingStore()
      store.objects = [
        { id: 'test-1', isSelected: true },
        { id: 'test-2', isSelected: false }
      ]
      store.selectedObjectId = 'test-1'

      store.selectObject('test-2')

      expect(store.objects[0].isSelected).toBe(false)
      expect(store.objects[1].isSelected).toBe(true)
      expect(store.selectedObjectId).toBe('test-2')
    })
  })

  describe('deselectAll', () => {
    it('should set isSelected to false for all objects', () => {
      const store = useDrawingStore()
      store.objects = [
        { id: 'test-1', isSelected: true },
        { id: 'test-2', isSelected: true }
      ]
      store.selectedObjectId = 'test-1'

      store.deselectAll()

      expect(store.objects[0].isSelected).toBe(false)
      expect(store.objects[1].isSelected).toBe(false)
      expect(store.selectedObjectId).toBe(null)
    })
  })

  describe('bringToFront', () => {
    it('should set zIndex to maxZIndex + 1', () => {
      const store = useDrawingStore()
      store.objects = [
        { id: 'test-1', zIndex: 1 },
        { id: 'test-2', zIndex: 5 },
        { id: 'test-3', zIndex: 3 }
      ]

      store.bringToFront('test-1')

      expect(store.objects[0].zIndex).toBe(6)
    })

    it('should return false if object not found', () => {
      const store = useDrawingStore()
      const result = store.bringToFront('non-existent')

      expect(result).toBe(false)
    })
  })

  describe('sendToBack', () => {
    it('should set zIndex to minZIndex - 1', () => {
      const store = useDrawingStore()
      store.objects = [
        { id: 'test-1', zIndex: 5 },
        { id: 'test-2', zIndex: 1 },
        { id: 'test-3', zIndex: 3 }
      ]

      store.sendToBack('test-1')

      expect(store.objects[0].zIndex).toBe(0)
    })

    it('should return false if object not found', () => {
      const store = useDrawingStore()
      const result = store.sendToBack('non-existent')

      expect(result).toBe(false)
    })
  })

  describe('Getters', () => {
    describe('selectedObject', () => {
      it('should return selected object', () => {
        const store = useDrawingStore()
        store.objects = [
          { id: 'test-1', name: 'Object 1' },
          { id: 'test-2', name: 'Object 2' }
        ]
        store.selectedObjectId = 'test-1'

        expect(store.selectedObject).toMatchObject({ id: 'test-1', name: 'Object 1' })
      })

      it('should return null if no object selected', () => {
        const store = useDrawingStore()
        store.objects = [{ id: 'test-1' }]
        store.selectedObjectId = null

        expect(store.selectedObject).toBe(null)
      })
    })

    describe('getObjectById', () => {
      it('should return object by id', () => {
        const store = useDrawingStore()
        store.objects = [
          { id: 'test-1', name: 'Object 1' },
          { id: 'test-2', name: 'Object 2' }
        ]

        const result = store.getObjectById('test-2')

        expect(result).toMatchObject({ id: 'test-2', name: 'Object 2' })
      })

      it('should return null if object not found', () => {
        const store = useDrawingStore()
        store.objects = [{ id: 'test-1' }]

        const result = store.getObjectById('non-existent')

        expect(result).toBe(null)
      })
    })

    describe('sortedObjects', () => {
      it('should return objects sorted by zIndex', () => {
        const store = useDrawingStore()
        store.objects = [
          { id: 'test-1', zIndex: 5 },
          { id: 'test-2', zIndex: 1 },
          { id: 'test-3', zIndex: 3 }
        ]

        const sorted = store.sortedObjects

        expect(sorted[0].id).toBe('test-2')
        expect(sorted[1].id).toBe('test-3')
        expect(sorted[2].id).toBe('test-1')
      })

      it('should handle objects without zIndex', () => {
        const store = useDrawingStore()
        store.objects = [
          { id: 'test-1', zIndex: 5 },
          { id: 'test-2' }, // no zIndex
          { id: 'test-3', zIndex: 3 }
        ]

        const sorted = store.sortedObjects

        expect(sorted[0].id).toBe('test-2') // zIndex defaults to 0
        expect(sorted[1].id).toBe('test-3')
        expect(sorted[2].id).toBe('test-1')
      })
    })
  })

  describe('Additional methods', () => {
    describe('loadObjects', () => {
      it('should load objects from array', () => {
        const store = useDrawingStore()
        const objectsData = [
          { id: 'test-1', type: 'image' },
          { id: 'test-2', type: 'shape' }
        ]

        store.loadObjects(objectsData)

        expect(store.objects).toHaveLength(2)
        expect(store.objects[0].id).toBe('test-1')
        expect(store.objects[1].id).toBe('test-2')
      })

      it('should reset selection on load', () => {
        const store = useDrawingStore()
        const objectsData = [{ id: 'test-1', isSelected: true }]

        store.loadObjects(objectsData)

        expect(store.objects[0].isSelected).toBe(false)
        expect(store.selectedObjectId).toBe(null)
      })
    })

    describe('clearObjects', () => {
      it('should clear all objects', () => {
        const store = useDrawingStore()
        store.objects = [{ id: 'test-1' }, { id: 'test-2' }]
        store.selectedObjectId = 'test-1'

        store.clearObjects()

        expect(store.objects).toEqual([])
        expect(store.selectedObjectId).toBe(null)
      })
    })

    describe('duplicateObject', () => {
      it('should create a copy of object with offset', () => {
        const store = useDrawingStore()
        store.objects = [{
          id: 'test-1',
          type: 'image',
          x: 100,
          y: 100,
          isSelected: false
        }]

        const newObj = store.duplicateObject('test-1', { x: 20, y: 20 })

        expect(newObj).toBeDefined()
        expect(newObj.id).not.toBe('test-1')
        expect(newObj.x).toBe(120)
        expect(newObj.y).toBe(120)
        expect(newObj.type).toBe('image')
      })
    })
  })
})
