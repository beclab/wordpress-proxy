import httpProxy from 'http-proxy';
import { business } from './business';
import { Protocol } from 'puppeteer';
import * as pako from 'pako'

const SERVER_PROXY_URL = process.env.SERVER_PROXY_URL
const SERVER_PROXY_DOMAIN = process.env.SERVER_PROXY_DOMAIN
const THIS_DOMAIN = process.env.THIS_DOMAIN

const proxy = httpProxy.createProxyServer(
    {
        target: SERVER_PROXY_URL,
        headers: {
            host: SERVER_PROXY_DOMAIN as string,
        },
        selfHandleResponse: true
    }
).listen(8001);

interface CookieHolder {
    cookie: Protocol.Network.Cookie[] | undefined
    time: number | undefined
}

const holders: Map<string, CookieHolder> = new Map()

// const cookieHolder: {
//     cookie: Protocol.Network.Cookie[] | undefined
//     time: number | undefined
// } = {
//     cookie: undefined,
//     time: undefined
// }



proxy.on('proxyReq', async (proxyReq, req, res, options) => {
    console.log('on proxyReq')
    // console.log('proxyReq', proxyReq)
    // console.log('req', req)
    // console.log('res', res)
    // console.log('options', options)

    const cookie = proxyReq.getHeader('cookie')
    console.log('cookie', cookie)
})

proxy.on('proxyRes', async (proxyRes, req, res) => {
    console.log('on proxyRes')
    // console.log('proxyRes', proxyRes)
    // console.log('req', req)
    // console.log('res', res)

    const cookie = req.headers.cookie
    console.log('req cookie', cookie)
    const xhost = req.headers['x-forwarded-host']
    console.log('xhost', xhost)
    const cookies = cookie?.split(';')

    console.log('req.url', req.url)

    if (req.url == '/') {
        res.writeHead(302, '', {
            // 'location': `https://${xhost}/admin/`
            'location': `https://${THIS_DOMAIN}/admin/`
        })
        res.end()
        return
    }

    let cookieHolder: CookieHolder | undefined = holders.get(req.headers['user-agent'] as string)
    if (cookieHolder == undefined) {
        cookieHolder = {
            cookie: undefined,
            time: undefined
        }

        holders.set(req.headers['user-agent'] as string, cookieHolder)
    }


    
    // if ((req.url == 'os-admin' || req.url == 'os-login') && proxyRes.statusCode == 302 && proxyRes.headers.location == '/wp-login.php') {
        if (cookies == undefined || cookieHolder.cookie == undefined) {
            console.log('cookies', cookies)
            console.log('cookieHolder.cookie', cookieHolder.cookie)
            //sync 
            let user = req.headers['x-bfl-user'] as string
            let resp = await business.syncCookie('', user, req.headers)
    
            if (resp.code == 0 || resp.cookie == undefined) {
                // throw new Error("state error");
                console.error('state error resp.code == 0 || resp.cookie == undefined')
                return
            }
            console.log('check:cookie size:pass')
    
            cookieHolder.cookie = resp.cookie
            cookieHolder.time = new Date().getTime()
            
            if (THIS_DOMAIN == undefined) {
                // throw new Error("not found THIS_DOMAIN");
                console.error("not found THIS_DOMAIN")
                return 
            }
            console.log('check:THIS_DOMAIN:pass')
    
            let domainThis: string[] = THIS_DOMAIN.split('.') as string[]
            let localDomainThis: string[] = [domainThis[0], 'local', ...domainThis?.slice(1)]
    
            //set cookie 
            let newArr: string[] = []
    
            if (cookieHolder.cookie == undefined) {
                // throw new Error("state error");
                console.error("cookieHolder.cookie == undefined")
                return
            }
    
            console.log('check:cookieHolder:pass')
            for (const c of cookieHolder.cookie) {
                const date: Date = new Date(c.expires * 1000);
                newArr.push(`${c.name}=${c.value};domain=${THIS_DOMAIN};path=${c.path};${c.httpOnly == true ? 'httpOnly' : ''};${c.secure == true ? 'secure' : ''};sameSite=${c.sameSite},${c.expires == -1 ? 'expires=Fri, 31 Dec 9999 23:59:59 GMT' : `expires=${date.toUTCString()}`};`)
                newArr.push(`${c.name}=${c.value};domain=${localDomainThis.join('.')};path=${c.path};${c.httpOnly == true ? 'httpOnly' : ''};${c.secure == true ? 'secure' : ''};sameSite=${c.sameSite},${c.expires == -1 ? 'expires=Fri, 31 Dec 9999 23:59:59 GMT' : `expires=${date.toUTCString()}`};`)
            }
            
            console.log('reset cookie', newArr)
            let headers = {
                'set-cookie': newArr,
                // 'location': `https://${xhost}/admin/`
                'location': `https://${THIS_DOMAIN}/admin/`
            }
            //重定向
            res.writeHead(302, '', headers)
            res.end()
            return
    
        } else {
            let hit_c = 0
            console.log('cookieHolder.cookie', cookieHolder.cookie)
            console.log('cookies', cookies)
            
            for (const c of cookies) {
                let values = c.split('=')
                for (const cc of cookieHolder.cookie as any[]) {
    
                    console.log('values[0].replace', values[0].replace(' ', ''))
                    console.log('cc.name.replace', cc.name.replace(' ', ''))
    
                    if (cc.name.replace(' ', '') == values[0].replace(' ', '')) {
                        console.log('cc.expires', cc.expires)
                        console.log('new Date().getTime()', new Date().getTime())
                        if (cc.expires == -1 || cc.expires * 1000 > new Date().getTime()) {
                            hit_c++
                        }
                    }
                } 
            }
            console.log('hit_c', hit_c)
            // if (hit_c == (cookieHolder.cookie as any[]).length) {
            if (hit_c >= 3) {
                // pass
                console.log('hit_c pass')
            } else {
                //sync 
                console.log('re sync cookie')
                let user = req.headers['x-bfl-user'] as string
                let resp = await business.syncCookie(req.headers['cookie'] ? req.headers['cookie'] : '', user, req.headers)
    
                if (resp.code != 0 && resp.cookie != undefined) {
                    cookieHolder.cookie = resp.cookie
                    cookieHolder.time = new Date().getTime()
                    
                    //set cookie 
                    let newArr: string[] = []
            
                    if (cookieHolder.cookie == undefined) {
                        // throw new Error("state error");
                        console.error('state error cookieHolder.cookie == undefined')
                        return
                    }
    
                    if (THIS_DOMAIN == undefined) {
                        // throw new Error("not found THIS_DOMAIN");
                        console.error("not found THIS_DOMAIN")
                        return 
                    }
    
                    let domainThis: string[] = THIS_DOMAIN.split('.') as string[]
                    let localDomainThis: string[] = [domainThis[0], 'local', ...domainThis?.slice(1)]
    
                    for (const c of cookieHolder.cookie) {
                        const date: Date = new Date(c.expires * 1000);
                        
                        newArr.push(`${c.name}=${c.value};domain=${THIS_DOMAIN};path=${c.path};${c.httpOnly == true ? 'httpOnly' : ''};${c.secure == true ? 'secure' : ''};sameSite=${c.sameSite},${c.expires == -1 ? 'expires=Fri, 31 Dec 9999 23:59:59 GMT' : `expires=${date.toUTCString()}`};`)
                        newArr.push(`${c.name}=${c.value};domain=${localDomainThis.join('.')};path=${c.path};${c.httpOnly == true ? 'httpOnly' : ''};${c.secure == true ? 'secure' : ''};sameSite=${c.sameSite},${c.expires == -1 ? 'expires=Fri, 31 Dec 9999 23:59:59 GMT' : `expires=${date.toUTCString()}`};`)
                    }
                    
                    let headers = {
                        'set-cookie': newArr,
                        // 'location': `https://${xhost}/admin/`
                        'location': `https://${THIS_DOMAIN}/admin/`
                    }
                    //重定向
                    res.writeHead(302, '', headers)
                    res.end()
                    return
                }
    
    
    
            }
    
        }
    // }



    const newHeader: {
        location: string | undefined,
        link: string,
        'x-frame-options': string
    } = {
        location : '',
        link: '',
        'x-frame-options': ''
    }
    const regex1 = new RegExp(SERVER_PROXY_DOMAIN as string, "g");
    if (proxyRes.statusCode == 302) {      
        newHeader.location = proxyRes.headers.location?.replace(regex1, THIS_DOMAIN as string)
    }
    console.log('proxyRes.headers', proxyRes.headers)
    if (proxyRes.headers['link'] != undefined) {
        newHeader.link = (proxyRes.headers['link'] as string).replace(regex1, THIS_DOMAIN as string)
    }


    // This project uses front-end routing, and there is no redirection function on the server side
    // console.log('proxyRes.statusCode', proxyRes.statusCode)
    // if (proxyRes.statusCode == 302) {
    //     console.log('proxyRes.headers.location', proxyRes.headers.location)
    // }

    let nh = Object.assign({}, proxyRes.headers, newHeader)
    console.log('nh', nh)
    res.writeHead(proxyRes.statusCode ? proxyRes.statusCode : 404, proxyRes.statusMessage, nh)

    let body: any[] = [];
    
    proxyRes.on('data', function (chunk: any) {
        body.push(chunk);
    });
    proxyRes.on('end', function () {
        
        // res.write("");

        if (req.url == '/wp-json/' || req.url == '/wp-admin/') {

            let s = ''
            if (proxyRes.headers['content-encoding'] == 'gzip') {
                console.log('Buffer.concat(body).length', Buffer.concat(body).length)
                s = pako.ungzip(Buffer.concat(body), { to: 'string'})
                console.log('wp-json:', s)
                s = s.replace(regex1, THIS_DOMAIN as string)
                console.log(s)
            } else {
                console.log('Buffer.concat(body).length', Buffer.concat(body).length)
                s = Buffer.concat(body).toString()
                console.log('wp-json:', s)
                s = s.replace(regex1, THIS_DOMAIN as string)
                console.log(s)
            }



            // const uint8Array = new TextEncoder().encode(s.replace(regex1, THIS_DOMAIN as string));
            
            // res.write(pako.deflate(uint8Array))

            const uint8Array = new TextEncoder().encode(s)

            res.write(pako.gzip(uint8Array))
        } 
        // else if (req.url == '/wp-admin/'){
        // } 
        else {
            res.write(Buffer.concat(body))
        }

        
        res.end()
        // res.end("my response to cli");

        console.log('proxyRes on end')
    });
})