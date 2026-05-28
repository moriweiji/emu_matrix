import { _decorator, Component, Sprite, Material, Vec3, Node, Tween, tween, Color } from 'cc';

const { ccclass, property, executeInEditMode, menu, requireComponent } = _decorator;

/**
 * 梦幻动态效果 —— 控制脚本
 * 将此组件挂载到带有 Sprite 的节点上，配合 dreamy.effect 使用
 *
 * 功能：
 *  1. Shader 参数实时控制（发光 / 色散 / 波纹 / 呼吸 / 星尘）
 *  2. 节点级呼吸缩放 & 浮动动画
 *  3. flash() 闪光方法，适合 UI 高亮/交互反馈
 */
@ccclass('DreamyEffect')
@executeInEditMode          // 编辑器中也能实时预览
@menu('Effects/DreamyEffect')
@requireComponent(Sprite)
export class DreamyEffect extends Component {

    // ===================== Glow 发光 =====================
    @property({ group: { name: 'Glow 发光', id: 'glow' }, tooltip: '发光强度', range: [0, 5, 0.01] })
    @property glowIntensity: number = 1.2;
    @property({ group: { name: 'Glow 发光', id: 'glow' }, tooltip: '发光颜色' })
    @property glowColor: Color = new Color(255, 235, 217, 255);
    // ===================== Distortion 扭曲 =====================
    @property({ group: { name: 'Distortion 扭曲', id: 'dist' }, tooltip: '波纹扭曲强度', range: [0, 0.1, 0.001] })
    @property distortion: number = 0.012;
    // ===================== Chromatic 色散 =====================
    @property({ group: { name: 'Chromatic 色散', id: 'chroma' }, tooltip: 'RGB 通道偏移量', range: [0, 0.02, 0.001] })
    @property chromaOffset: number = 0.003;
    // ===================== Breath 呼吸 =====================
    @property({ group: { name: 'Breath 呼吸', id: 'breath' }, tooltip: '呼吸速度', range: [0, 5, 0.01] })
    @property breathSpeed: number = 1.2;
    @property({ group: { name: 'Breath 呼吸', id: 'breath' }, tooltip: '呼吸幅度', range: [0, 1, 0.01] })
    @property breathRange: number = 0.15;
    // ===================== Sparkle 星尘 =====================
    @property({ group: { name: 'Sparkle 星尘', id: 'spark' }, tooltip: '星尘闪烁强度', range: [0, 2, 0.01] });
    @property sparkleIntensity: number = 0.4;
    @property({ group: { name: 'Sparkle 星尘', id: 'spark' }, tooltip: '星尘密度', range: [1, 50, 0.5] })
    @property sparkleScale: number = 15.0;
    // ===================== 节点动画 =====================
    @property({ group: { name: 'Animation 动画', id: 'anim' }, tooltip: '启用呼吸缩放' })
    enableBreathScale: boolean = true;
    @property({ group: { name: 'Animation 动画', id: 'anim' }, tooltip: '缩放幅度', range: [0, 0.2, 0.005] })
    scaleAmplitude: number = 0.03;
    @property({ group: { name: 'Animation 动画', id: 'anim' }, tooltip: '启用浮动效果' })
    enableFloat: boolean = true;
    @property({ group: { name: 'Animation 动画', id: 'anim' }, tooltip: '浮动幅度（像素）', range: [0, 30, 0.5] })
    floatAmplitude: number = 5.0;
    // ===================== 内部变量 =====================
    private _sprite: Sprite | null = null;
    private _material: Material | null = null;
    private _originScale: Vec3 = new Vec3();
    private _originPos: Vec3 = new Vec3();
    private _tweenScale: Tween<Node> | null = null;
    private _tweenFloat: Tween<Node> | null = null;
    // ===================== 生命周期 =====================
    onLoad() {
        this._sprite = this.getComponent(Sprite)!;
        this._refreshMaterial();
        Vec3.copy(this._originScale, this.node.scale);
        Vec3.copy(this._originPos, this.node.position);
        this._syncAll();
    }
    onEnable() {
        this._startAnimations();
    }
    onDisable() {
        this._stopAnimations();
    }
    // ===================== 材质操作 =====================
    /** 重新获取材质引用 */
    private _refreshMaterial() {
        if (this._sprite) {
            this._material = this._sprite.getMaterial(0);
        }
    }
    /** 设置单个 uniform */
    private _setProp(name: string, value: number | Color) {
        if (!this._material) this._refreshMaterial();
        if (this._material) {
            this._material.setProperty(name, value);
        }
    }
    /** 全量同步所有参数到材质 */
    private _syncAll() {
        this._setProp('glowIntensity', this.glowIntensity);
        this._setProp('distortion', this.distortion);
        this._setProp('breathSpeed', this.breathSpeed);
        this._setProp('breathRange', this.breathRange);
        this._setProp('chromaOffset', this.chromaOffset);
        this._setProp('sparkleIntensity', this.sparkleIntensity);
        this._setProp('sparkleScale', this.sparkleScale);
        this._setProp('glowColor', this.glowColor);
    }
    // ===================== 节点动画 =====================
    private _startAnimations() {
        this._stopAnimations();
        if (this.enableBreathScale) this._startBreathScale();
        if (this.enableFloat) this._startFloat();
    }
    private _stopAnimations() {
        this._tweenScale?.stop();
        this._tweenScale = null;
        this._tweenFloat?.stop();
        this._tweenFloat = null;
        // 恢复原始变换
        if (this._originScale.lengthSqr() > 0) this.node.setScale(this._originScale);
        if (this._originPos.lengthSqr() >= 0) this.node.setPosition(this._originPos);
    }
    /** 呼吸缩放 —— 缓慢放大缩小 */
    private _startBreathScale() {
        const s = this._originScale;
        const a = this.scaleAmplitude;
        const up = new Vec3(s.x * (1 + a), s.y * (1 + a), s.z);
        const down = new Vec3(s.x * (1 - a), s.y * (1 - a), s.z);
        const dur = 2.0 / Math.max(this.breathSpeed, 0.01);

        this._tweenScale = tween(this.node)
            .to(dur, { scale: up }, { easing: 'sineInOut' })
            .to(dur, { scale: down }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start() as Tween<Node>;
    }
    /** 浮动效果 —— 缓慢上下漂浮 */
    private _startFloat() {
        const p = this._originPos;
        const a = this.floatAmplitude;
        const up = new Vec3(p.x, p.y + a, p.z);
        const down = new Vec3(p.x, p.y - a, p.z);

        this._tweenFloat = tween(this.node)
            .to(3.0, { position: up }, { easing: 'sineInOut' })
            .to(3.0, { position: down }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start() as Tween<Node>;
    }
    // ===================== 公开方法 =====================
    /**
     * 播放一次闪光特效（发光强度瞬间拉高再回落）
     * 适合按钮点击、获得奖励等 UI 反馈场景
     *
     * @param duration     闪光持续时间（秒）
     * @param peakIntensity 闪光峰值发光强度
     */
    flash(duration: number = 0.6, peakIntensity: number = 3.0) {
        const original = this.glowIntensity;
        this.glowIntensity = peakIntensity;

        tween({ val: peakIntensity })
            .to(duration, { val: original }, {
                onUpdate: (target: any) => {
                    this.glowIntensity = target.val;
                }
            })
            .start();
    }
    /**
     * 渐变过渡到目标参数
     * 可用于场景切换、状态变化时的平滑过渡
     */
    transitionTo(target: Partial<IDreamyParams>, duration: number = 1.0) {
        const startValues: Record<string, number> = {};

        if (target.glowIntensity !== undefined) {
            startValues.glowIntensity = this.glowIntensity;
            tween({ v: startValues.glowIntensity })
                .to(duration, { v: target.glowIntensity }, {
                    onUpdate: (t: any) => { this.glowIntensity = t.v; }
                }).start();
        }
        if (target.distortion !== undefined) {
            startValues.distortion = this.distortion;
            tween({ v: startValues.distortion })
                .to(duration, { v: target.distortion }, {
                    onUpdate: (t: any) => { this.distortion = t.v; }
                }).start();
        }
        if (target.chromaOffset !== undefined) {
            startValues.chromaOffset = this.chromaOffset;
            tween({ v: startValues.chromaOffset })
                .to(duration, { v: target.chromaOffset }, {
                    onUpdate: (t: any) => { this.chromaOffset = t.v; }
                }).start();
        }
        if (target.sparkleIntensity !== undefined) {
            startValues.sparkleIntensity = this.sparkleIntensity;
            tween({ v: startValues.sparkleIntensity })
                .to(duration, { v: target.sparkleIntensity }, {
                    onUpdate: (t: any) => { this.sparkleIntensity = t.v; }
                }).start();
        }
    }
    /** 重置为默认参数 */
    resetToDefault() {
        this.glowIntensity = 1.2;
        this.distortion = 0.012;
        this.breathSpeed = 1.2;
        this.breathRange = 0.15;
        this.chromaOffset = 0.003;
        this.sparkleIntensity = 0.4;
        this.sparkleScale = 15.0;
        this.glowColor = new Color(255, 235, 217, 255);
    }
}
/** 可渐变过渡的参数子集 */
export interface IDreamyParams {
    glowIntensity: number;
    distortion: number;
    chromaOffset: number;
    sparkleIntensity: number;
}
